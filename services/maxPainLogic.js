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
    const strikes = [...new Set(optionsData.map(option => option.strike_price))];
    const intrinsicValues = {};

    strikes.forEach(strike => {
        let totalIntrinsicValue = 0;
        optionsData.forEach(option => {
            const value = optionValueExpiry(option.strike_price, option.open_interest, strike, option.option_type);
            totalIntrinsicValue += value;
        });
        intrinsicValues[strike] = totalIntrinsicValue;
    });

    const minIntrinsicValue = Math.min(...Object.values(intrinsicValues));
    const maxPain = parseFloat(Object.keys(intrinsicValues).find(key => intrinsicValues[key] === minIntrinsicValue));

    return { maxPain, intrinsicValues };  // Возвращаем и maxPain, и intrinsicValues
};

module.exports = { calculateMaxPain };
