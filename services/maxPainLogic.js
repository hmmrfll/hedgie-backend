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

    // Проверяем, есть ли данные
    if (!optionsData || optionsData.length === 0) {
        return { maxPain: 0, intrinsicValues: {} };
    }

    const strikes = [...new Set(optionsData.map(option => option.strike_price))];

    const intrinsicValues = {};

    strikes.forEach(strike => {
        let totalIntrinsicValue = 0;

        optionsData.forEach(option => {
            try {
                const value = optionValueExpiry(option.strike_price, option.open_interest, strike, option.option_type);
                totalIntrinsicValue += value;
            } catch (error) {
            }
        });

        intrinsicValues[strike] = totalIntrinsicValue;
    });


    if (Object.keys(intrinsicValues).length === 0) {
        return { maxPain: 0, intrinsicValues: {} };
    }

    const intrinsicValuesArray = Object.values(intrinsicValues);
    const minIntrinsicValue = Math.min(...intrinsicValuesArray);

    // Более надежный способ поиска ключа
    let maxPainStrike = null;
    let minDiff = Infinity;

    for (const [strike, value] of Object.entries(intrinsicValues)) {
        const diff = Math.abs(value - minIntrinsicValue);
        if (diff < minDiff) {
            minDiff = diff;
            maxPainStrike = strike;
        }
    }

    const maxPain = parseFloat(maxPainStrike);

    return { maxPain, intrinsicValues };
};


module.exports = { calculateMaxPain };
