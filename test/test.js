// TODO: Test multiple tasks executing synchronously. I think, only the first of them will be executed.

var rush = require('./../index.js');
var stackParser = require('stack-parser');

var check = function(condition, message) {
	if (condition)
		return;

	if (typeof message === 'undefined')
		message = '';
	else
		message += ' ';

	var where = stackParser.here()[1].format('(%f, line %l)');
	console.log('FAILED: ' + message + where);
};

// Calls cb(err, param). Error is set if param === false.
var asyncAction = function(param, cb) {
	setTimeout(function() {
		if (param !== false)
			cb(null, param);
		else
			cb(new Error('An error in asyncAction() occurred.'));
	}, Math.random() * 100 | 0);
};

// Calls cb(param, err). Error is set if param === false.
var weirdAsyncAction = function(param, cb) {
	setTimeout(function() {
		if (param !== false)
			cb(param, null);
		else
			cb(null, new Error('An error in weirdAsyncAction() occurred.'));
	}, 0);
};

console.log('Running tests...\n');

var finalizers = {};

// Test initialization errors.

try {
	rush();
	check(false);
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'An attempt to execute an too short Rush chain. A chain must have one or more blocks and a finalizer.');
}

try {
	rush(function() {})();
	check(false);
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'An attempt to execute an too short Rush chain. A chain must have one or more blocks and a finalizer.');
}

try {
	rush(function() {})(function(err) {})()();
	check(false);
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'An attempt to execute a Rush chain twice or alter it after execution.');
}

try {
	rush(1);
	check(false);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'Single argument passed to Rush should be either a function or an object.');
}

try {
	rush(function() {}, 1);
	check(false);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'When two arguments are passed to Rush, each of them should be a function.');
}

try {
	rush(1, function() {});
	check(false);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'When two arguments are passed to Rush, each of them should be a function.');
}

try {
	rush(1, 1);
	check(false);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'When two arguments are passed to Rush, each of them should be a function.');
}

try {
	rush(1, 1, 1);
	check(false);
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'Invalid number of arguments passed to Rush.');
}

try {
	rush(function() {})(function() {}, function() {})();
	check(false);
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'Finalizer should be passed as a single argument.');
}

// Test initializers.

rush({ x: 2, y: 3 })(function() {
	check(this.x === 2);
	check(this.y === 3);
})(function(err) {
	check(!err);
})();

rush({
	x: 2
})(function() {
	// TODO: This should actually be "=== 2", but currently such behaviour is not implemented.
	check(this.x === 3);
})({
	x: 3
})(function() {
	check(this.x === 3);
})(function(err) {
	check(!err);
	check(this.x === 3);
	finalizers.a1 = true;
})();

// Test proper context application.

rush({ z: 1 })(function() {
	this.n = 1;
	check(this.z === 1);

	asyncAction(1, this(function(v) {
		this.n++;
		check(this.z === 1);
	}));

	asyncAction(false, this(function(v) {
		// Never called.
	}, function(err) {
		this.n++;
		check(this.z === 1);
	}));
})(function() {
	this.n++;
	throw new Error(); // Force block error handler to be executed.
}, function(err) {
	this.n++;
	check(this.z === 1);
})(function(err) {
	check(this.z === 1);
	check(this.n === 5);
	finalizers.a2 = true;
})();

// Test this() errors.

rush(function() {
	try {
		this();
	} catch(err) {
		check(err instanceof TypeError);
		check(err.message === 'A callback function should be passed.');
	}

	try {
		this(1);
	} catch(err) {
		check(err instanceof TypeError);
		check(err.message === 'A callback passed to be wrapped should be a function.');
	}

	try {
		this(function() {}, 1);
	} catch(err) {
		check(err instanceof TypeError);
		check(err.message === 'An error handler passed with the callback should be a function.');
	}

	var f = this(function() {}, function(err) {});
	f(); // Otherwise the finalizer won't be called.
})(function(err) {
	check(!err);
	finalizers.a3 = true;
})();

rush({
	value1: 'v1',
	n: 100
})(function() {
	check(this.value1 === 'v1');

	asyncAction(1, this(function(result) {
		check(result === 1);
		this.n++;
	}));

	asyncAction(2, this(function(result) {
		check(result === 2);
		this.n++;
	}));

	asyncAction(3, this(function(result) {
		check(result === 3);
		this.n++;
	}));

	check(this.n === 100);
})(function(err) {
	finalizers.a4 = true;
	check(!err);
	check(this.value1 === 'v1');
	check(this.n === 103);
})();

rush({
	n: 1
})(function() {
	check(this.n === 1);
	this.n++;
})(function() {
	check(this.n === 2);
	this.n++;
})(function(err) {
	finalizers.a5 = true;
	check(!err);
	check(this.n === 3);
})();

rush(function() {
	this.n = 1;
	asyncAction(3, this(function(result) {
		check(result === 3);
		this.n++;
	}));
})(function() {
	check(this.n === 2);
	this.n++;
})(function() {
	check(this.n === 3);
	this.n++;
	asyncAction(3, this(function(result) {
		check(result === 3);
		this.n++;
	}));
})(function() {
	check(this.n === 5);
	this.n++;
})(function(err) {
	finalizers.a6 = true;
	check(!err);
	check(this.n === 6);
})();

// Test exceptions in blocks.

rush(function() {
	throw new Error('Test exception.');
})(function(err) {
	finalizers.b1 = true;
	check(err instanceof Error);
	check(err && err.message === 'Test exception.');
})();

// Check task failing, and sealing of callbacks.

rush(function() {
	this.n = 1;

	setTimeout(this(function() {
		this.a = 1;
		throw new Error('Test exception.');
	}), 100);

	setTimeout(this(function() {
		this.b = 1;
		check(false);
	}), 500);

	setTimeout(this(function() {
		this.c = 1;
		check(false);
	}), 500);
})(function() {
	this.n++;
})(function(err) {
	finalizers.b2 = true;
	check(err && err.message === 'Test exception.');
	check(this.n === 1);
	check(this.a && !this.b && !this.c);
})();

// Test task error handler suppressing errors.

rush(function() {
	this.n = 1;

	asyncAction(false, this(function() {
		this.n++; // This should not be called.
		check(false);
	}, function(err) {
		check(err && err.message === 'An error in asyncAction() occurred.');
		this.e = 1;
	}));
})(function() {
	this.n2 = 1;
})(function(err) {
	finalizers.b3 = true;
	check(!err);
	check(this.n === 1);
	check(this.e === 1);
	check(this.n2 === 1);
})();

// Check task error handler throwing.

rush(function() {
	this.n = 1;

	asyncAction(false, this(function() {
		this.n++; // This should not be called.
		check(false);
	}, function(err) {
		throw new Error('Another error.');
	}));
})(function() {
	this.n2 = 1;
})(function(err) {
	finalizers.b4 = true;
	check(err)
	check(err && err.message === 'Another error.');
	check(this.n === 1);
	check(this.n2 !== 1);
})();

// Test block error handler catching and suppressing errors.

rush({
	n: 0
})(function() {
	this.n++;
	throw new Error('Error in block.');
}, function(err) {
	check(err && err.message === 'Error in block.');
	this.a = 1;
})(function() {
	this.n++;
	asyncAction(1, this(function() {
		throw new Error('Error in async callback.');
	}));
}, function(err) {
	check(err && err.message === 'Error in async callback.');
	this.b = 1;
})(function() {
	this.n++;
	asyncAction(false, this(function() {}));
}, function(err) {
	check(err && err.message === 'An error in asyncAction() occurred.');
	this.c = 1;
})(function() {
	this.n++;
	asyncAction(false, this(function() {}, function(err) {
		throw new Error('Error in task error handler.');
	}));
}, function(err) {
	check(err && err.message === 'Error in task error handler.');
	this.d = 1;
})(function(err) {
	finalizers.b5 = true;
	check(!err);
	console.log(err.stack);
	check(this.n === 4);
	check(this.a === 1);
	check(this.b === 1);
	check(this.c === 1);
	check(this.d === 1);
})();

// Test block error handler throwing errors.

rush(function() {
	setTimeout(this(function() {}), 100);
})(function() {
	throw new Error('Some error.');
}, function(err) {
	throw new Error('Another error.');
})(function(err) {
	finalizers.b6 = true;
	check(err && err.message === 'Another error.');
})();

setTimeout(function() {
	check(finalizers.a1);
	check(finalizers.a2);
	check(finalizers.a3);
	check(finalizers.a4);
	check(finalizers.a5);
	check(finalizers.a6);

	check(finalizers.b1);
	check(finalizers.b2);
	check(finalizers.b3);
	check(finalizers.b4);
	check(finalizers.b5);
	check(finalizers.b6);

	console.log('\nTesting completed.');
}, 2000);
