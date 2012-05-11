var RushBlockContext = function() {

};

var rushChainer = function() {
	/*
	 * 1. An object is passed.
	 *   - Merge it into the context.
	 * 2. A function is passed.
	 *   - Add a new block to the chain.
	 * 3. No arguments passed.
	 *   - Execute the chain, mark chain as executed to suppress successive calls of chainer.
	 */
	if (this.__executed)
		throw new Error('An attempt to execute a Rush chain twice.');

	var numArgs = arguments.length;
	
	if (numArgs == 1) {
		var arg0 = arguments[0];

		if (typeof arg0 === 'function') {
			// A function is passed. Add a new block to the chain.
			// Adding [ callback, blockErrorHandler ].
			this.__chain.push([ arg0, null ]);
		} else if (arg0 !== null && typeof arg0 === 'object') {
			// An object is passed. Merge it into the chain context.
			for (var k in arg0)
				this.__context[k] = arg0[k];
		} else {
			throw new TypeError('Single argument passed to Rush should be either a function or an object.');
		}
	} else if (numArgs == 0) {
		this.__executeChain();
	} else if (numArgs == 2) {
		var arg0 = arguments[0], arg1 = arguments[1];

		// Two functions should be passed.
		if (typeof arg0 !== 'function' || typeof arg1 !== 'function')
			throw new TypeError('When two arguments are passed to Rush, each of them should be a function.');

		// So, we have a block function and a block error handler.
		// Add [ callback, blockErrorHandler ] to the chain.
		this.__chain.push(arg0, arg1);
	} else {
		throw new Error('Invalid number of arguments passed to Rush.');
	}

	return this.__chainer;
};

var rushChainerStatePrototype = {
	__executeChain: function() {
		console.log('Executing chain...');

		var block;

		for (var i = 0; i < this.__chain.length; i++) {
			block = this.__chain[i]; // [ cb, errorHandler | null ]

			try {

			} catch(e) {

			}
		}

		// Prevent accidental double chain execution.
		this.__executed = true;
	}
};

var rush = function() {
	var state = {};
	state.__proto__ = rushChainerStatePrototype;
	state.__chainer = rushChainer.bind(state);
	state.__context = {};
	state.__chain = []; // Array of [ callback, blockErrorHandler | null ].
	// state.__executed is set in __executeChain() to prevent double chain execution.
	return state.__chainer.apply(null, arguments);
};

module.exports = rush;