var RushBlockContext = function() {

};

var RushChainer = function() {
	/*
	 * 1. An object is passed.
	 *   - Merge it into the context.
	 * 2. A function is passed.
	 *   - Add a new block to the chain.
	 * 3. No arguments passed.
	 *   - Execute the chain.
	 */
	console.log(this);
	
	if (arguments.length == 1 && typeof arguments[0] === 'function') {
		// A function is passed. Add a new block to the chain.
		this.__chain.push(arguments[0]);
	}

	if (arguments.length == 0)
		this.__executeChain();

	return this.__fn;
};

var RushChainerStatePrototype = {
	__executeChain: function() {
		console.log('executing chain...');
	}
};

var Rush = function() {
	var state = {};
	state.__proto__ = RushChainerStatePrototype;
	state.__context = {};
	state.__chain = [];
	state.__fn = RushChainer.bind(state);
	return state.__fn.apply(null, arguments);
};

module.exports = Rush;
