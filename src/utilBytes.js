var utilBytes = function() {
	
}

utilBytes.prototype.zeroFill = function(number, width) {
	width -= number.toString().length;
 	if (width > 0) {
    	return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
	}
	return number + ""; // always return a string
}

module.exports = new utilBytes()