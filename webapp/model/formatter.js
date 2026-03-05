sap.ui.define([], function () {
    "use strict";

    return {

        /**
         * Format a number to 2 decimal places.
         * @param {number} fValue
         * @returns {string}
         */
        formatDecimal: function (fValue) {
            if (fValue === null || fValue === undefined || isNaN(fValue)) {
                return "0.00";
            }
            return parseFloat(fValue).toFixed(2);
        },

        /**
         * Return sap.ui.core.ValueState based on sign of delta.
         * Positive delta (price increase) → Error (red)
         * Negative delta (price decrease) → Success (green)
         * Zero                            → None
         * @param {number} fValue
         * @returns {string} ValueState
         */
        formatDeltaState: function (fValue) {
            const f = parseFloat(fValue);
            if (isNaN(f) || f === 0) { return "None"; }
            return f > 0 ? "Error" : "Success";
        },

        /**
         * Format a rate value to 2 decimal places (used for charge rates).
         * @param {number} fValue
         * @returns {string}
         */
        formatRate: function (fValue) {
            return parseFloat(fValue || 0).toFixed(2);
        },

        /**
         * Format an OData date string (YYYY-MM-DD) to local display format.
         * @param {string} sDate
         * @returns {string}
         */
        formatDate: function (sDate) {
            if (!sDate) { return ""; }
            const oDate = new Date(sDate);
            if (isNaN(oDate.getTime())) { return sDate; }
            return oDate.toLocaleDateString(sap.ui.getCore().getConfiguration().getLanguage(), {
                year  : "numeric",
                month : "2-digit",
                day   : "2-digit"
            });
        }

    };
});
