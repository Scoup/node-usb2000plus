/**
 * HR2000Data is used to receive and convert the data of spectros
 * All Spectometer specifications can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20HR2000+.pdf
 */
function HR2000Data(callback) {
	this.totalFrames = 8
	this.output = []
	this.callback = callback ? callback : function() {};
	this.counter = 0
}

/**
 * Clear cache
 */
HR2000Data.prototype.clear = function() {
	this.output = []
	this.counter = 0
}

/**
 * Add data to cache
 * All calls is asynchronous and the data has to be merged
 */
HR2000Data.prototype.addData = function(data) {
	var self = this
	data = this.convertData(data)
	this.output.push(data)
	this.counter++
	if(this.counter === this.totalFrames)
		this.callback(self.getData())
}

/**
 * Return the data output
 */
HR2000Data.prototype.getData = function() {
	return this.output
}

/**
 * Convert the data to output
 *
 * * Removed from documentation:
 * All pixel values are 16-bit values organized in LSB | MSB order. Bit 13 has 
 * to be flipped for every pixel before converting to an integer. This is 
 * equivalent to performing a xor 0x20 with MSB. There is an additional
 * packet containing one value that is used as a flag to insure proper 
 * synchronization between the PC and HR2000+ */
HR2000Data.prototype.convertData = function(data) {
	data = data.toString('hex')
	var size = data.length / 2
	var output = [size]
	for(var i = 0; i < size; i+=2) {
		var part = data.substring(i,i+2)
		output[i/2] = parseInt(part ^0x20, 16)
	}
	return output
}