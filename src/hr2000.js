/*
 * node-hr2000
 * https://github.com/leo/node-hr2000
 *
 * Copyright (c) 2014 Léo Haddad M. C. Carneiro 
 * Licensed under the MIT license.
 */

/****
 * How to use:
 * var HR2000 = require('HR2000').HR2000
 * var lib = new HR2000()
 *
 * List of HR2000+ endpoints
 * EP1Out = 0x01
 * EP2In = 0x82
 * EP6In = 0x86
 * EP1In = 0x81
 */
 /*jshint -W117 */ //ignore missing others files
 /*jshint -W083 */ //ignore create function with loop
var us = require('underscore')
var usb = require("usb")

var HR2000Factory = function() {

	var factory = this

	var _options = {
		VID: 0x2457,
		PID: 0x101E,
		integrationTime: 3000,
		strobleEnableStatus: 0,
		shutdownMode: 0,
		triggerMode: 0
	}


	function HR2000(options) {
		this._internal = {
			claimed: false,
			busy: false
		}

		// this.endpoints = new Endpoints()
		this.funcs = new HR2000Funcs()
		this.spectroData = new HR2000Data(function(){})

		this.options = us.defaults(options || {}, _options);

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
			if(typeof(HR2000.prototype[func.name]) === 'undefined') {
				HR2000.prototype[func.name] = function(callback, extraData) {
					this.genericFunction(callback, func.data, extraData)
				}
			}
		}

		this.claim()
	}

	HR2000.prototype.requestSpectra = function(callback) {
		var self = this
		var func = this.funcs.getByName('requestSpectra')
		var calb = function(error, callback) {
			self._internal.busy = false
			callback(error, data)
		}

		this.spectroData = new HR2000Data(callback)
		this.genericFunction.call(this, calb, func)
	}

	/**
	 * Set the settings of Endpoints
	 */
	HR2000.prototype.configEndPoints = function() {
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
			if(self.callback !== null)
				self.callback(data)
		})
	}

	/**
	 * Claim for device and start the stream of endpoints
	 */
	HR2000.prototype.claim = function() {
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
	HR2000.prototype.release = function() {
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
	HR2000.prototype.genericFunction = function(callback, data, extraData) {
		if(this._internal.busy){
			var error = "The spectrometer is busy"
			callback(error, null)
			return
		}

		var EP1Out = this.EP1Out
		var buffer = new Buffer(1)
		buffer[0] = data
		if(extraData !== undefined) {
			buffer = new Buffer(extraData.length + 1)
			buffer[0] = data
			buffer.push(extraData)
		}

		if(typeof(callback) === 'function') 
			this.callback = callback
		else
			this.callback = null

		EP1Out.write(buffer)
	}

	factory.HR2000 = HR2000
}

var factory = new HR2000Factory()
module.exports = factory;
	