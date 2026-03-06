sap.ui.define([], function () {
    "use strict";

    return {

        formatDecimal: function (fValue) {
            if (fValue === null || fValue === undefined || isNaN(fValue)) {
                return "0.00";
            }
            return parseFloat(fValue).toFixed(2);
        },

        formatDeltaState: function (fValue) {
            // const f = parseFloat(fValue);
            // if (isNaN(f) || f === 0) { return "None"; }
            // return f > 0 ? "Error" : "Success";
            return "Success"
        },

        formatRate: function (fValue) {
            return parseFloat(fValue || 0).toFixed(2);
        },

        formatDate: function (sDate) {
            if (!sDate) { return ""; }
            console.log(sDate);
            const oDate = new Date();
            console.log(oDate);
            if (isNaN(oDate.getTime())) { return sDate; }
            return oDate.toLocaleDateString(sap.ui.getCore().getConfiguration().getLanguage(), {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
        }

    };
});
