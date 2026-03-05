/*global QUnit*/

sap.ui.define([
	"priceamendmentautomation/controller/PriceAutomation.controller"
], function (Controller) {
	"use strict";

	QUnit.module("PriceAutomation Controller");

	QUnit.test("I should test the PriceAutomation controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
