sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../model/formatter"
], function (Controller, JSONModel, MessageBox, MessageToast, formatter) {
    "use strict";

    return Controller.extend("priceamendmentautomation.controller.PriceAutomation", {

        formatter: formatter,


        onInit: function () {
            const oViewModel = new JSONModel({
                selectedVendorCode: "",
                selectedCommodity: "",
                vendorData: {},
                rmPrices: [],
                currency: {
                    currentRate: 89,
                    newRate: 92,
                    deltaRate: 3
                },
                charges: [
                    { name: "ICC", rate: 0, apply: "Yes" },
                    { name: "Rejection", rate: 0, apply: "Yes" },
                    { name: "OH", rate: 0, apply: "Yes" },
                    { name: "Profit", rate: 0, apply: "Yes" },
                    { name: "BCD", rate: 0, apply: "Yes" }
                ],
                summary: {
                    totalRmDelta: 0,
                    revisedPartPrice: 0
                }
            });

            this.getView().setModel(oViewModel, "view");

            this._loadVendorList();
        },

        _loadVendorList: function () {
            const oODataModel = this.getOwnerComponent().getModel();

            oODataModel.bindList("/Vendor").requestContexts().then((aContexts) => {
                const oSelect = this.byId("selVendorCode");
                oSelect.destroyItems();
                oSelect.addItem(new sap.ui.core.Item({ key: "", text: "-- Select --" }));

                const aVendorCodes = [...new Set(aContexts.map(c => c.getProperty("vendorCode")))];
                aVendorCodes.forEach((sCode) => {
                    oSelect.addItem(new sap.ui.core.Item({ key: sCode, text: sCode }));
                });

                this._allVendorContexts = aContexts.map(c => c.getObject());
            }).catch((oError) => {
                MessageBox.error("Failed to load vendor list: " + oError.message);
            });
        },

        onVendorChange: function (oEvent) {
            const sVendorCode = oEvent.getSource().getSelectedKey();
            const oViewModel = this.getView().getModel("view");

            oViewModel.setProperty("/selectedVendorCode", sVendorCode);
            oViewModel.setProperty("/selectedCommodity", "");
            oViewModel.setProperty("/rmPrices", []);
            oViewModel.setProperty("/vendorData", {});

            const oCommoditySelect = this.byId("selCommodity");
            oCommoditySelect.destroyItems();
            oCommoditySelect.addItem(new sap.ui.core.Item({ key: "", text: "-- Select --" }));

            if (sVendorCode && this._allVendorContexts) {
                const aCommodities = this._allVendorContexts
                    .filter(v => v.vendorCode === sVendorCode)
                    .map(v => v.commodity);

                [...new Set(aCommodities)].forEach((sCommodity) => {
                    oCommoditySelect.addItem(new sap.ui.core.Item({ key: sCommodity, text: sCommodity }));
                });
            }
        },

        onCommodityChange: function (oEvent) {
            const sCommodity = oEvent.getSource().getSelectedKey();
            const oViewModel = this.getView().getModel("view");
            const sVendorCode = oViewModel.getProperty("/selectedVendorCode");

            if (!sCommodity || !sVendorCode) { return; }

            oViewModel.setProperty("/selectedCommodity", sCommodity);

            const oODataModel = this.getOwnerComponent().getModel();

            oODataModel
                .bindContext(`/Vendor(vendorCode='${sVendorCode}',commodity='${sCommodity}')`, null, {
                    $expand: "rawMaterialPrices"
                })
                .requestObject()
                .then((oVendor) => {
                    this._populateViewFromVendor(oVendor);
                })
                .catch((oError) => {
                    MessageBox.error("Failed to load vendor data: " + oError.message);
                });
        },

        _populateViewFromVendor: function (oVendor) {
            const oViewModel = this.getView().getModel("view");
            const aRmPrices = (oVendor.rawMaterialPrices || []).map((rm) => {

                const fDeltaContent = parseFloat(
                    Math.abs((rm.newRmRate || 0) - (rm.currentRmRate || 0)).toFixed(4)
                );

                const fDeltaScrap = parseFloat(
                    Math.abs((rm.newScrapRate || 0) - (rm.currentScrapRate || 0)).toFixed(4)
                );
                return {
                    rmCode: rm.rmCode,
                    rmName: rm.rmName,
                    currentRmRate: rm.currentRmRate || 0,
                    newRmRate: rm.newRmRate || 0,
                    deltaContentRate: fDeltaContent,
                    currentScrapRate: rm.currentScrapRate || 0,
                    newScrapRate: rm.newScrapRate || 0,
                    deltaScrapRate: fDeltaScrap,
                    overallRmImpact: parseFloat((fDeltaContent + fDeltaScrap).toFixed(4))
                };
            });

            oViewModel.setProperty("/vendorData", oVendor);
            oViewModel.setProperty("/vendorData/effectiveDate",new Date().toISOString().split("T")[0]);
            oViewModel.setProperty("/rmPrices", aRmPrices);

            const oTable = this.byId("rmTable");
            oTable.setVisibleRowCount(Math.max(aRmPrices.length, aRmPrices.length));

            const aCharges = oViewModel.getProperty("/charges");

            const chargeMap = {
                ICC: oVendor.iCC || 0,
                Rejection: oVendor.rejection || 0,
                OH: oVendor.oH || 0,
                Profit: oVendor.profit || 0,
                BCD: oVendor.bCD || 0
            };

            aCharges.forEach(c => {
                if (chargeMap[c.name] !== undefined) {
                    c.rate = chargeMap[c.name];
                }
            });

            oViewModel.setProperty("/charges", aCharges);

            this._recalcSummary();
        },
        onRmRateChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("view");
            const sPath = oContext.getPath();
            const oModel = this.getView().getModel("view");

            const fNew = Math.abs(parseFloat(oInput.getValue()) || 0);
            const fCurrent = Math.abs(parseFloat(oModel.getProperty(sPath + "/currentRmRate")) || 0);
            const fDelta = Math.abs(parseFloat((fNew - fCurrent).toFixed(4)));

            oModel.setProperty(sPath + "/newRmRate", fNew);
            oModel.setProperty(sPath + "/deltaContentRate", fDelta);

            this._recalcRowImpact(sPath);
            this._recalcSummary();
        },

        onScrapRateChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("view");
            const sPath = oContext.getPath();
            const oModel = this.getView().getModel("view");

            const fNew = Math.abs(parseFloat(oInput.getValue()) || 0);
            const fCurrent = Math.abs(parseFloat(oModel.getProperty(sPath + "/currentScrapRate")) || 0);
            const fDelta = Math.abs(parseFloat((fNew - fCurrent).toFixed(4)));

            oModel.setProperty(sPath + "/newScrapRate", fNew);
            oModel.setProperty(sPath + "/deltaScrapRate", fDelta);

            this._recalcRowImpact(sPath);
            this._recalcSummary();
        },

        onCurrencyChange: function () {
            const oModel = this.getView().getModel("view");
            const fNew = parseFloat(oModel.getProperty("/currency/newRate")) || 0;
            const fCurrent = parseFloat(oModel.getProperty("/currency/currentRate")) || 0;

            oModel.setProperty(
                "/currency/deltaRate",
                parseFloat(Math.abs(fNew - fCurrent).toFixed(4))
            );
            this._recalcSummary();
        },

        onAddRmRow: function () {
            const oModel = this.getView().getModel("view");
            const aRows = oModel.getProperty("/rmPrices");

            aRows.push({
                rmCode: "Content " + (aRows.length + 1),
                rmName: "",
                currentRmRate: 0,
                newRmRate: 0,
                deltaContentRate: 0,
                currentScrapRate: 0,
                newScrapRate: 0,
                deltaScrapRate: 0,
                overallRmImpact: 0
            });

            oModel.setProperty("/rmPrices", aRows);
            this.byId("rmTable").setVisibleRowCount(aRows.length);
        },

        onDeleteRmRow: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("view");
            const iIndex = parseInt(oContext.getPath().split("/").pop());
            const oModel = this.getView().getModel("view");
            const aRows = oModel.getProperty("/rmPrices");

            if (aRows.length <= 1) {
                MessageToast.show("At least one RM row is required.");
                return;
            }

            aRows.splice(iIndex, 1);
            oModel.setProperty("/rmPrices", aRows);
            this.byId("rmTable").setVisibleRowCount(aRows.length);
            this._recalcSummary();
        },

        onReset: function () {
            MessageBox.confirm("Reset all fields?", {
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        const oViewModel = this.getView().getModel("view");
                        const sVendorCode = oViewModel.getProperty("/selectedVendorCode");
                        const sCommodity = oViewModel.getProperty("/selectedCommodity");

                        if (sVendorCode && sCommodity) {
                            const oODataModel = this.getOwnerComponent().getModel();
                            oODataModel
                                .bindContext(`/Vendor(vendorCode='${sVendorCode}',commodity='${sCommodity}')`, null, {
                                    $expand: "rawMaterialPrices"
                                })
                                .requestObject()
                                .then((oVendor) => this._populateViewFromVendor(oVendor))
                                .catch(() => MessageBox.error("Reset failed."));
                        }
                    }
                }
            });
        },

        onSave: function () {
            const oViewModel = this.getView().getModel("view");
            const sVendorCode = oViewModel.getProperty("/selectedVendorCode");
            const sCommodity = oViewModel.getProperty("/selectedCommodity");

            if (!sVendorCode || !sCommodity) {
                MessageBox.error("Please select a Vendor and Commodity first.");
                return;
            }

            const oODataModel = this.getOwnerComponent().getModel();
            const aRmPrices = oViewModel.getProperty("/rmPrices");

            const aPatches = aRmPrices.map((rm) => {
                const oBinding = oODataModel.bindContext(
                    `/RawMaterialPrice(rmCode='${rm.rmCode}',vendorCode='${sVendorCode}',commodity='${sCommodity}')`
                );

                return oBinding.requestObject().then(() => {
                    const oContext = oBinding.getBoundContext();
                    oContext.setProperty("newRmRate", rm.newRmRate);
                    oContext.setProperty("newScrapRate", rm.newScrapRate);
                });
            });

            Promise.all(aPatches)
                .then(() => oODataModel.submitBatch("$auto"))
                .then(() => {
                    MessageToast.show("Saved successfully.");
                })
                .catch((oError) => {
                    MessageBox.error("Save failed: " + oError.message);
                });
        },

        _recalcRowImpact: function (sPath) {
            const oModel = this.getView().getModel("view");
            const fDeltaRM = parseFloat(oModel.getProperty(sPath + "/deltaContentRate")) || 0;
            const fDeltaSc = parseFloat(oModel.getProperty(sPath + "/deltaScrapRate")) || 0;
            oModel.setProperty(sPath + "/overallRmImpact", parseFloat((fDeltaRM + fDeltaSc).toFixed(4)));
        },

        _recalcSummary: function () {
            const oModel = this.getView().getModel("view");
            const aRows = oModel.getProperty("/rmPrices");
            const fTotalRmDelta = aRows.reduce((acc, r) => acc + (parseFloat(r.overallRmImpact) || 0), 0);
            const fCurrDelta = parseFloat(oModel.getProperty("/currency/deltaRate")) || 0;

            oModel.setProperty("/summary/totalRmDelta", parseFloat(fTotalRmDelta.toFixed(4)));
            oModel.setProperty("/summary/revisedPartPrice", parseFloat((fTotalRmDelta + fCurrDelta).toFixed(4)));
        }, onEffectiveDateChange: function (oEvent) {
            const oDP = oEvent.getSource();
            const bValid = oEvent.getParameter("valid");

            if (!bValid) {
                oDP.setValueState("Error");
                oDP.setValueStateText("Please enter a valid date.");
                return;
            }

            oDP.setValueState("None");
            const sDate = oEvent.getParameter("value");
            this.getView().getModel("view")
                .setProperty("/vendorData/effectiveDate", sDate);
        }

    });
});
