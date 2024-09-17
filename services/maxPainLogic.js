// Функция для извлечения даты экспирации из instrument_name

const optionValueExpiry = (strike, size, underlyingPrice, optionType) => {
    if (optionType === "C") {
        return Math.max(0, underlyingPrice - strike) * size;
    } else if (optionType === "P") {
        return Math.max(0, strike - underlyingPrice) * size;
    } else {
        throw new Error("Invalid option type");
    }
};

const calculateMaxPain = (optionsData) => {
    // Собираем уникальные страйки из всех опционов
    const strikes = [...new Set(optionsData.map(option => option.strike_price))];
    const intrinsicValues = {};

    // Для каждого страйка рассчитываем суммарную внутреннюю стоимость
    strikes.forEach(strike => {
        let totalIntrinsicValue = 0;

        // Проходим по каждому опциону и вычисляем его внутреннюю стоимость
        optionsData.forEach(option => {
            const value = optionValueExpiry(option.strike_price, option.open_interest, strike, option.option_type);
            totalIntrinsicValue += value;
        });

        // Сохраняем внутренние значения для каждого страйка
        intrinsicValues[strike] = totalIntrinsicValue;
    });

    // Находим страйк, для которого внутренняя стоимость минимальна — это и есть Max Pain
    const minIntrinsicValue = Math.min(...Object.values(intrinsicValues));
    const maxPain = parseFloat(Object.keys(intrinsicValues).find(key => intrinsicValues[key] === minIntrinsicValue));

    return { maxPain, intrinsicValues };  // Возвращаем и Max Pain, и intrinsicValues
};

module.exports = { calculateMaxPain };
