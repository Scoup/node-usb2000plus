/**
 * USB2000QueryStatus is used to receive and convert the data of spectros
 * All Spectometer specifications can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20USB2000+.pdf
 */
function USB2000QueryStatus(callback, data) {
	var output = this.setData(data)
	callback(null, output)
}

/**
 * The data is returned in Binary format and read in by the host through End
 * Point 1 In. The structure for the return information is as follows:
 */
USB2000QueryStatus.prototype.queryStatusList = {
	0: 'Number of pixels',
	2: 'Integration Time',
	6: 'Lamp Enable',
	7: 'Trigger Mode Value',
	8: 'Spectral Acquisition Status',
	9: 'Packets In Spectra',
	10: 'Power Down Flag',
	11: 'Packet Count',
	12: 'Reserved',
	13: 'Reserved',
	14: 'USB Comunications Speed',
	15: 'Reserved'
}

USB2000QueryStatus.prototype.reserved = [12,13,15]

/**
 * Clear cache
 */
USB2000QueryStatus.prototype.clear = function() {
	this.output = []
	this.counter = 0
}

/**
 * Add data to cache
 * All calls is asynchronous and the data has to be merged
 */
USB2000QueryStatus.prototype.setData = function(data) {
	var output = {}
	for(var key in this.queryStatusList) {
		var name = this.queryStatusList[key]
		if(key === '0') 
			output[name] = this.getNumberOfPixels(data)
		else if(key === '2')
			output[name] = this.getIntegrationTime(data)
		else if(this.reserved.indexOf(parseInt(key)) == -1)
			output[name] = data[key]
	}
	this.output = output
	return output
}

USB2000QueryStatus.prototype.getIntegrationTime = function(data) {
	var output = []
	var j = 0
	for(var i = 5; i >= 2; i--){
		output[j] = this.zeroFill(data[i].toString(16),2)
		j++
	}

	var value = output.join('')
	return parseInt(value, 16)
}

USB2000QueryStatus.prototype.getNumberOfPixels = function(data) {
	var output = []
	output[0] = this.zeroFill(data[1].toString(16),2)
	output[1] = this.zeroFill(data[0].toString(16),2)
	var value = output.join('')
	return parseInt(value, 16)
}

USB2000QueryStatus.prototype.zeroFill = factory.USB2000.prototype.zeroFill;

/**
 * Return the data output
 */
USB2000QueryStatus.prototype.getData = function() {
	return this.output
}


