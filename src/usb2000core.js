/*
 * node-usb2000plus
 * https://github.com/leo/node-usb2000plus
 *
 * Copyright (c) 2014 Léo Haddad M. C. Carneiro 
 * Licensed under the MIT license.
 */

/****
 * How to use:
 * var USB2000 = require('USB2000').USB2000
 * var lib = new USB2000()
 *
 * List of USB2000+ endpoints
 * EP1Out = 0x01
 * EP2In = 0x82
 * EP6In = 0x86
 * EP1In = 0x81
 */
 /*jshint -W117 */ //ignore missing others files
 /*jshint -W083 */ //ignore create function with loop
var us = require('underscore')
var usb = require("usb")

var USB2000Data = require('./usb2000data.js')
var USB2000QueryStatus = require('./usb2000querystatus.js')
var USB2000Funcs = require('./usb2000funcs.js')
var utilBytes = require('./utilBytes')

var USB2000Factory = function() {

	var factory = this

	var _options = {
		VID: 0x2457,
		PID: 0x101E,
		integrationTime: 3000,
		strobleEnableStatus: 0,
		model: 'hr4000', //or can be hr2000+
		shutdownMode: 0,
		triggerMode: 0
	}


	function USB2000(options) {
		this._internal = {
			claimed: false,
			busy: false
		}

		// this.endpoints = new Endpoints()
		this.funcs = new USB2000Funcs()
		this.spectroData = new USB2000Data(function(){})

		this.options = us.defaults(options || {}, _options);
		this.spectroData.model = this.options.model

		var VID = this.options.VID, PID = this.options.PID
		this.device = usb.findByIds(VID, PID)
		this.device.open()

		this.iface = this.device.interfaces[0]

		this.configEndPoints()

		//configure generic functions to send data
		//ex: this.requestSpectra()
		var funcs = this.funcs.getFuncs()

		for(var i = 0; i < funcs.length; i++) {
			var func = funcs[i]
			//@todo fix this. func.data not getting the right value, only the last one
			if(typeof(USB2000.prototype[func.name]) === 'undefined') {
				var data = func.data
				USB2000.prototype[func.name] = function(callback, extraData) {
					// console.log(func.data)
					this.genericFunction(callback, data, extraData)
				}
			}
		}

		this.claim()
	}

	/**
	 * Set the settings of Endpoints
	 */
	USB2000.prototype.configEndPoints = function() {
		var self = this
		var iface = this.iface
		this.EP1In = iface.endpoint(0x81)
		this.EP1Out = iface.endpoint(0x01)
		this.EP2In = iface.endpoint(0x82)

		//spectro data
		this.EP2In.on("data", function(data) {
			self.spectroData.addData(data)
		})

		//all others data
		this.EP1In.on("data", function(data) {
			// console.log(data)
			self._internal.busy = false
			if(self.callback !== null)
				self.callback(null, data)
		})
	}

	USB2000.prototype.requestSpectra = function(callback) {
		var self = this
		var func = this.funcs.getByName('requestSpectra')
		var calb = function(error, callback) {
			self._internal.busy = false
			callback(error, data)
		}

		this.spectroData = new USB2000Data(callback)
		this.spectroData.model = this.options.model
		this.genericFunction.call(this, calb, func.data)
	}

	USB2000.prototype.setIntegrationTime = function(callback, time) {
		//3s = 3000ms = 300000000us
		//00000000 00101101 11000110 11000000
		//LSW-LSB  LSW-MSB  MSW-LSB  MSW-MSB
		//converted:
		//11000000 11000110 00101101 00000000
		var self = this
		var func = this.funcs.getByName('setIntegrationTime')
		var bin = time.toString(2)
		var bin = utilBytes.zeroFill(bin, 32)
		var buffer = new Buffer(4)
		var j = 3
		var joined = []
		for(var i = 0; i < 32; i+=8) {
			var bt = bin.substring(i, i+8)
			buffer[j] = parseInt(bt,2)
			joined[j] = bt
			j--
		}

		this.genericFunction.call(this, null, func.data, buffer)
		callback(null, null)
	}

	USB2000.prototype.queryStatus = function(callback) {
		var func = this.funcs.getByName('queryStatus')
		var cb = function(error, data) {
			if(error != null) {
				callback(error, data)
				return
			}
			var queryStatus = new USB2000QueryStatus(callback, data)
		}
		this.genericFunction.call(this, cb, func.data)
	}

	/**
	 * Sets the USB2000+ shutdown mode. When shutdown, the internal FX2 microcontroller is
	 * continuously running however all other functionality is disabled. In this power down mode the current
	 * consumption is reduced to 250mA (operating current for the FX2 microcontroller). When shutdown is
	 * active (active low), the external 5V signal (V5_Switched pin 3) is disabled in addition to all other
	 * signals except I2C lines.
	 * Data Byte = 0 => Shutdown everything but the FX2
	 * Data Byte = !0 => Power up entire Spectrometer
	 */

	USB2000.prototype.setShutdownMode = function(callback, status) {
		status = status != null && status != undefined ? status : true

		var buffer = new Buffer(2)
		if(status){
			buffer[0] = 1
			buffer[1] = 0
		}
		else{
			buffer[0] = 0
			buffer[1] = 0
		}
		var func = this.funcs.getByName('setShutdownMode')
		this.genericFunction.call(this, null, func.data, buffer)
		callback(null, null)
	}

	/**
	 * Get the temperature of spectrometer
	 * Temperature (oC) = .003906 * ADC Value
	 * Byte 0 => Read Result
	 * Byte 1 => ADC Value LSB 
	 * Byte 2 => ADC Value MSB
	 */
	USB2000.prototype.readPcbTemperature = function(callback) {
		var func = this.funcs.getByName('readPcbTemperature')
		var cb = function(error, data) {
			if(callback != null)
				callback(error, data)
		}
		this.genericFunction.call(this, cb, func.data)
	}



	/**
	 * Claim for device and start the stream of endpoints
	 */
	USB2000.prototype.claim = function() {
		if(this._internal.claimed) return

		var iface = this.iface
		if(iface.isKernelDriverActive()) iface.detachKernelDriver()
		iface.claim()

		this.EP1In.startStream(1, 512)
		this.EP2In.startStream(1, 512)

		this._internal.claimed = true
	}

	/**
	 * Stop streams and release device
	 */
	USB2000.prototype.release = function() {
		if(!this._internal.claimed) return

		this.EP1In.stopStream()
		this.EP2In.stopStream()
		this.iface.release()

		this._internal.claimed = false
	}

	/**
	 * Provide a generic function to send data to spectrometer
	 * @callback - Function(data) - a function to callback, receive a data 
	 * @data - Int - integer referenced to the internal method of spectrometer
	 * @extraData - ByteArray - a array of extra datas, some functions need it
	 */
	USB2000.prototype.genericFunction = function(callback, data, extraData) {
		if(this._internal.busy){
			var error = "The spectrometer is busy"
			callback(error, null)
			return
		}

		var EP1Out = this.EP1Out
		var buffer = new Buffer(1)
		buffer[0] = data
		if(extraData !== undefined) {
			buffer = Buffer.concat([buffer, extraData], extraData.length + 1)
		}

		if(typeof(callback) === 'function') 
			this.callback = callback
		else
			this.callback = null

		// console.log('call', buffer)
		EP1Out.write(buffer)
	}

	factory.USB2000 = USB2000
}

var factory = new USB2000Factory()
module.exports = factory;
	