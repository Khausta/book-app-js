(function () {
    'use strict';

    class AbstractView {
        constructor() {
            this.app = document.getElementById('root'); 
        }

        setTitle(title) {
            document.title = title;
        }

        render() {
            return;
        }

        destroy() {
            return;
        }
    }

    const PATH_SEPARATOR = '.';
    const TARGET = Symbol('target');
    const UNSUBSCRIBE = Symbol('unsubscribe');

    function isBuiltinWithMutableMethods(value) {
    	return value instanceof Date
    		|| value instanceof Set
    		|| value instanceof Map
    		|| value instanceof WeakSet
    		|| value instanceof WeakMap
    		|| ArrayBuffer.isView(value);
    }

    function isBuiltinWithoutMutableMethods(value) {
    	return (typeof value === 'object' ? value === null : typeof value !== 'function') || value instanceof RegExp;
    }

    var isArray = Array.isArray;

    function isSymbol(value) {
    	return typeof value === 'symbol';
    }

    const path = {
    	after: (path, subPath) => {
    		if (isArray(path)) {
    			return path.slice(subPath.length);
    		}

    		if (subPath === '') {
    			return path;
    		}

    		return path.slice(subPath.length + 1);
    	},
    	concat: (path, key) => {
    		if (isArray(path)) {
    			path = [...path];

    			if (key) {
    				path.push(key);
    			}

    			return path;
    		}

    		if (key && key.toString !== undefined) {
    			if (path !== '') {
    				path += PATH_SEPARATOR;
    			}

    			if (isSymbol(key)) {
    				return path + key.toString();
    			}

    			return path + key;
    		}

    		return path;
    	},
    	initial: path => {
    		if (isArray(path)) {
    			return path.slice(0, -1);
    		}

    		if (path === '') {
    			return path;
    		}

    		const index = path.lastIndexOf(PATH_SEPARATOR);

    		if (index === -1) {
    			return '';
    		}

    		return path.slice(0, index);
    	},
    	last: path => {
    		if (isArray(path)) {
    			return path[path.length - 1] || '';
    		}

    		if (path === '') {
    			return path;
    		}

    		const index = path.lastIndexOf(PATH_SEPARATOR);

    		if (index === -1) {
    			return path;
    		}

    		return path.slice(index + 1);
    	},
    	walk: (path, callback) => {
    		if (isArray(path)) {
    			for (const key of path) {
    				callback(key);
    			}
    		} else if (path !== '') {
    			let position = 0;
    			let index = path.indexOf(PATH_SEPARATOR);

    			if (index === -1) {
    				callback(path);
    			} else {
    				while (position < path.length) {
    					if (index === -1) {
    						index = path.length;
    					}

    					callback(path.slice(position, index));

    					position = index + 1;
    					index = path.indexOf(PATH_SEPARATOR, position);
    				}
    			}
    		}
    	},
    	get(object, path) {
    		this.walk(path, key => {
    			if (object) {
    				object = object[key];
    			}
    		});

    		return object;
    	},
    };

    function isIterator(value) {
    	return typeof value === 'object' && typeof value.next === 'function';
    }

    // eslint-disable-next-line max-params
    function wrapIterator(iterator, target, thisArg, applyPath, prepareValue) {
    	const originalNext = iterator.next;

    	if (target.name === 'entries') {
    		iterator.next = function () {
    			const result = originalNext.call(this);

    			if (result.done === false) {
    				result.value[0] = prepareValue(
    					result.value[0],
    					target,
    					result.value[0],
    					applyPath,
    				);
    				result.value[1] = prepareValue(
    					result.value[1],
    					target,
    					result.value[0],
    					applyPath,
    				);
    			}

    			return result;
    		};
    	} else if (target.name === 'values') {
    		const keyIterator = thisArg[TARGET].keys();

    		iterator.next = function () {
    			const result = originalNext.call(this);

    			if (result.done === false) {
    				result.value = prepareValue(
    					result.value,
    					target,
    					keyIterator.next().value,
    					applyPath,
    				);
    			}

    			return result;
    		};
    	} else {
    		iterator.next = function () {
    			const result = originalNext.call(this);

    			if (result.done === false) {
    				result.value = prepareValue(
    					result.value,
    					target,
    					result.value,
    					applyPath,
    				);
    			}

    			return result;
    		};
    	}

    	return iterator;
    }

    function ignoreProperty(cache, options, property) {
    	return cache.isUnsubscribed
    		|| (options.ignoreSymbols && isSymbol(property))
    		|| (options.ignoreUnderscores && property.charAt(0) === '_')
    		|| ('ignoreKeys' in options && options.ignoreKeys.includes(property));
    }

    /**
    @class Cache
    @private
    */
    class Cache {
    	constructor(equals) {
    		this._equals = equals;
    		this._proxyCache = new WeakMap();
    		this._pathCache = new WeakMap();
    		this.isUnsubscribed = false;
    	}

    	_getDescriptorCache() {
    		if (this._descriptorCache === undefined) {
    			this._descriptorCache = new WeakMap();
    		}

    		return this._descriptorCache;
    	}

    	_getProperties(target) {
    		const descriptorCache = this._getDescriptorCache();
    		let properties = descriptorCache.get(target);

    		if (properties === undefined) {
    			properties = {};
    			descriptorCache.set(target, properties);
    		}

    		return properties;
    	}

    	_getOwnPropertyDescriptor(target, property) {
    		if (this.isUnsubscribed) {
    			return Reflect.getOwnPropertyDescriptor(target, property);
    		}

    		const properties = this._getProperties(target);
    		let descriptor = properties[property];

    		if (descriptor === undefined) {
    			descriptor = Reflect.getOwnPropertyDescriptor(target, property);
    			properties[property] = descriptor;
    		}

    		return descriptor;
    	}

    	getProxy(target, path, handler, proxyTarget) {
    		if (this.isUnsubscribed) {
    			return target;
    		}

    		const reflectTarget = target[proxyTarget];
    		const source = reflectTarget || target;

    		this._pathCache.set(source, path);

    		let proxy = this._proxyCache.get(source);

    		if (proxy === undefined) {
    			proxy = reflectTarget === undefined
    				? new Proxy(target, handler)
    				: target;

    			this._proxyCache.set(source, proxy);
    		}

    		return proxy;
    	}

    	getPath(target) {
    		return this.isUnsubscribed ? undefined : this._pathCache.get(target);
    	}

    	isDetached(target, object) {
    		return !Object.is(target, path.get(object, this.getPath(target)));
    	}

    	defineProperty(target, property, descriptor) {
    		if (!Reflect.defineProperty(target, property, descriptor)) {
    			return false;
    		}

    		if (!this.isUnsubscribed) {
    			this._getProperties(target)[property] = descriptor;
    		}

    		return true;
    	}

    	setProperty(target, property, value, receiver, previous) { // eslint-disable-line max-params
    		if (!this._equals(previous, value) || !(property in target)) {
    			const descriptor = this._getOwnPropertyDescriptor(target, property);

    			if (descriptor !== undefined && 'set' in descriptor) {
    				return Reflect.set(target, property, value, receiver);
    			}

    			return Reflect.set(target, property, value);
    		}

    		return true;
    	}

    	deleteProperty(target, property, previous) {
    		if (Reflect.deleteProperty(target, property)) {
    			if (!this.isUnsubscribed) {
    				const properties = this._getDescriptorCache().get(target);

    				if (properties) {
    					delete properties[property];
    					this._pathCache.delete(previous);
    				}
    			}

    			return true;
    		}

    		return false;
    	}

    	isSameDescriptor(a, target, property) {
    		const b = this._getOwnPropertyDescriptor(target, property);

    		return a !== undefined
    			&& b !== undefined
    			&& Object.is(a.value, b.value)
    			&& (a.writable || false) === (b.writable || false)
    			&& (a.enumerable || false) === (b.enumerable || false)
    			&& (a.configurable || false) === (b.configurable || false)
    			&& a.get === b.get
    			&& a.set === b.set;
    	}

    	isGetInvariant(target, property) {
    		const descriptor = this._getOwnPropertyDescriptor(target, property);

    		return descriptor !== undefined
    			&& descriptor.configurable !== true
    			&& descriptor.writable !== true;
    	}

    	unsubscribe() {
    		this._descriptorCache = null;
    		this._pathCache = null;
    		this._proxyCache = null;
    		this.isUnsubscribed = true;
    	}
    }

    function isObject(value) {
    	return toString.call(value) === '[object Object]';
    }

    function isDiffCertain() {
    	return true;
    }

    function isDiffArrays(clone, value) {
    	return clone.length !== value.length || clone.some((item, index) => value[index] !== item);
    }

    const IMMUTABLE_OBJECT_METHODS = new Set([
    	'hasOwnProperty',
    	'isPrototypeOf',
    	'propertyIsEnumerable',
    	'toLocaleString',
    	'toString',
    	'valueOf',
    ]);

    const IMMUTABLE_ARRAY_METHODS = new Set([
    	'concat',
    	'includes',
    	'indexOf',
    	'join',
    	'keys',
    	'lastIndexOf',
    ]);

    const MUTABLE_ARRAY_METHODS = {
    	push: isDiffCertain,
    	pop: isDiffCertain,
    	shift: isDiffCertain,
    	unshift: isDiffCertain,
    	copyWithin: isDiffArrays,
    	reverse: isDiffArrays,
    	sort: isDiffArrays,
    	splice: isDiffArrays,
    	flat: isDiffArrays,
    	fill: isDiffArrays,
    };

    const HANDLED_ARRAY_METHODS = new Set([
    	...IMMUTABLE_OBJECT_METHODS,
    	...IMMUTABLE_ARRAY_METHODS,
    	...Object.keys(MUTABLE_ARRAY_METHODS),
    ]);

    function isDiffSets(clone, value) {
    	if (clone.size !== value.size) {
    		return true;
    	}

    	for (const element of clone) {
    		if (!value.has(element)) {
    			return true;
    		}
    	}

    	return false;
    }

    const COLLECTION_ITERATOR_METHODS = [
    	'keys',
    	'values',
    	'entries',
    ];

    const IMMUTABLE_SET_METHODS = new Set([
    	'has',
    	'toString',
    ]);

    const MUTABLE_SET_METHODS = {
    	add: isDiffSets,
    	clear: isDiffSets,
    	delete: isDiffSets,
    	forEach: isDiffSets,
    };

    const HANDLED_SET_METHODS = new Set([
    	...IMMUTABLE_SET_METHODS,
    	...Object.keys(MUTABLE_SET_METHODS),
    	...COLLECTION_ITERATOR_METHODS,
    ]);

    function isDiffMaps(clone, value) {
    	if (clone.size !== value.size) {
    		return true;
    	}

    	let bValue;
    	for (const [key, aValue] of clone) {
    		bValue = value.get(key);

    		if (bValue !== aValue || (bValue === undefined && !value.has(key))) {
    			return true;
    		}
    	}

    	return false;
    }

    const IMMUTABLE_MAP_METHODS = new Set([...IMMUTABLE_SET_METHODS, 'get']);

    const MUTABLE_MAP_METHODS = {
    	set: isDiffMaps,
    	clear: isDiffMaps,
    	delete: isDiffMaps,
    	forEach: isDiffMaps,
    };

    const HANDLED_MAP_METHODS = new Set([
    	...IMMUTABLE_MAP_METHODS,
    	...Object.keys(MUTABLE_MAP_METHODS),
    	...COLLECTION_ITERATOR_METHODS,
    ]);

    class CloneObject {
    	constructor(value, path, argumentsList, hasOnValidate) {
    		this._path = path;
    		this._isChanged = false;
    		this._clonedCache = new Set();
    		this._hasOnValidate = hasOnValidate;
    		this._changes = hasOnValidate ? [] : null;

    		this.clone = path === undefined ? value : this._shallowClone(value);
    	}

    	static isHandledMethod(name) {
    		return IMMUTABLE_OBJECT_METHODS.has(name);
    	}

    	_shallowClone(value) {
    		let clone = value;

    		if (isObject(value)) {
    			clone = {...value};
    		} else if (isArray(value) || ArrayBuffer.isView(value)) {
    			clone = [...value];
    		} else if (value instanceof Date) {
    			clone = new Date(value);
    		} else if (value instanceof Set) {
    			clone = new Set([...value].map(item => this._shallowClone(item)));
    		} else if (value instanceof Map) {
    			clone = new Map();

    			for (const [key, item] of value.entries()) {
    				clone.set(key, this._shallowClone(item));
    			}
    		}

    		this._clonedCache.add(clone);

    		return clone;
    	}

    	preferredThisArg(isHandledMethod, name, thisArg, thisProxyTarget) {
    		if (isHandledMethod) {
    			if (isArray(thisProxyTarget)) {
    				this._onIsChanged = MUTABLE_ARRAY_METHODS[name];
    			} else if (thisProxyTarget instanceof Set) {
    				this._onIsChanged = MUTABLE_SET_METHODS[name];
    			} else if (thisProxyTarget instanceof Map) {
    				this._onIsChanged = MUTABLE_MAP_METHODS[name];
    			}

    			return thisProxyTarget;
    		}

    		return thisArg;
    	}

    	update(fullPath, property, value) {
    		const changePath = path.after(fullPath, this._path);

    		if (property !== 'length') {
    			let object = this.clone;

    			path.walk(changePath, key => {
    				if (object && object[key]) {
    					if (!this._clonedCache.has(object[key])) {
    						object[key] = this._shallowClone(object[key]);
    					}

    					object = object[key];
    				}
    			});

    			if (this._hasOnValidate) {
    				this._changes.push({
    					path: changePath,
    					property,
    					previous: value,
    				});
    			}

    			if (object && object[property]) {
    				object[property] = value;
    			}
    		}

    		this._isChanged = true;
    	}

    	undo(object) {
    		let change;

    		for (let index = this._changes.length - 1; index !== -1; index--) {
    			change = this._changes[index];

    			path.get(object, change.path)[change.property] = change.previous;
    		}
    	}

    	isChanged(value) {
    		return this._onIsChanged === undefined
    			? this._isChanged
    			: this._onIsChanged(this.clone, value);
    	}
    }

    class CloneArray extends CloneObject {
    	static isHandledMethod(name) {
    		return HANDLED_ARRAY_METHODS.has(name);
    	}
    }

    class CloneDate extends CloneObject {
    	undo(object) {
    		object.setTime(this.clone.getTime());
    	}

    	isChanged(value, equals) {
    		return !equals(this.clone.valueOf(), value.valueOf());
    	}
    }

    class CloneSet extends CloneObject {
    	static isHandledMethod(name) {
    		return HANDLED_SET_METHODS.has(name);
    	}

    	undo(object) {
    		for (const value of this.clone) {
    			object.add(value);
    		}

    		for (const value of object) {
    			if (!this.clone.has(value)) {
    				object.delete(value);
    			}
    		}
    	}
    }

    class CloneMap extends CloneObject {
    	static isHandledMethod(name) {
    		return HANDLED_MAP_METHODS.has(name);
    	}

    	undo(object) {
    		for (const [key, value] of this.clone.entries()) {
    			object.set(key, value);
    		}

    		for (const key of object.keys()) {
    			if (!this.clone.has(key)) {
    				object.delete(key);
    			}
    		}
    	}
    }

    class CloneWeakSet extends CloneObject {
    	constructor(value, path, argumentsList, hasOnValidate) {
    		super(undefined, path, argumentsList, hasOnValidate);

    		this._arg1 = argumentsList[0];
    		this._weakValue = value.has(this._arg1);
    	}

    	isChanged(value) {
    		return this._weakValue !== value.has(this._arg1);
    	}

    	undo(object) {
    		if (this._weakValue && !object.has(this._arg1)) {
    			object.add(this._arg1);
    		} else {
    			object.delete(this._arg1);
    		}
    	}
    }

    class CloneWeakMap extends CloneObject {
    	constructor(value, path, argumentsList, hasOnValidate) {
    		super(undefined, path, argumentsList, hasOnValidate);

    		this._weakKey = argumentsList[0];
    		this._weakHas = value.has(this._weakKey);
    		this._weakValue = value.get(this._weakKey);
    	}

    	isChanged(value) {
    		return this._weakValue !== value.get(this._weakKey);
    	}

    	undo(object) {
    		const weakHas = object.has(this._weakKey);

    		if (this._weakHas && !weakHas) {
    			object.set(this._weakKey, this._weakValue);
    		} else if (!this._weakHas && weakHas) {
    			object.delete(this._weakKey);
    		} else if (this._weakValue !== object.get(this._weakKey)) {
    			object.set(this._weakKey, this._weakValue);
    		}
    	}
    }

    class SmartClone {
    	constructor(hasOnValidate) {
    		this._stack = [];
    		this._hasOnValidate = hasOnValidate;
    	}

    	static isHandledType(value) {
    		return isObject(value)
    			|| isArray(value)
    			|| isBuiltinWithMutableMethods(value);
    	}

    	static isHandledMethod(target, name) {
    		if (isObject(target)) {
    			return CloneObject.isHandledMethod(name);
    		}

    		if (isArray(target)) {
    			return CloneArray.isHandledMethod(name);
    		}

    		if (target instanceof Set) {
    			return CloneSet.isHandledMethod(name);
    		}

    		if (target instanceof Map) {
    			return CloneMap.isHandledMethod(name);
    		}

    		return isBuiltinWithMutableMethods(target);
    	}

    	get isCloning() {
    		return this._stack.length > 0;
    	}

    	start(value, path, argumentsList) {
    		let CloneClass = CloneObject;

    		if (isArray(value)) {
    			CloneClass = CloneArray;
    		} else if (value instanceof Date) {
    			CloneClass = CloneDate;
    		} else if (value instanceof Set) {
    			CloneClass = CloneSet;
    		} else if (value instanceof Map) {
    			CloneClass = CloneMap;
    		} else if (value instanceof WeakSet) {
    			CloneClass = CloneWeakSet;
    		} else if (value instanceof WeakMap) {
    			CloneClass = CloneWeakMap;
    		}

    		this._stack.push(new CloneClass(value, path, argumentsList, this._hasOnValidate));
    	}

    	update(fullPath, property, value) {
    		this._stack[this._stack.length - 1].update(fullPath, property, value);
    	}

    	preferredThisArg(target, thisArg, thisProxyTarget) {
    		const {name} = target;
    		const isHandledMethod = SmartClone.isHandledMethod(thisProxyTarget, name);

    		return this._stack[this._stack.length - 1]
    			.preferredThisArg(isHandledMethod, name, thisArg, thisProxyTarget);
    	}

    	isChanged(isMutable, value, equals) {
    		return this._stack[this._stack.length - 1].isChanged(isMutable, value, equals);
    	}

    	undo(object) {
    		if (this._previousClone !== undefined) {
    			this._previousClone.undo(object);
    		}
    	}

    	stop() {
    		this._previousClone = this._stack.pop();

    		return this._previousClone.clone;
    	}
    }

    /* eslint-disable unicorn/prefer-spread */

    const defaultOptions = {
    	equals: Object.is,
    	isShallow: false,
    	pathAsArray: false,
    	ignoreSymbols: false,
    	ignoreUnderscores: false,
    	ignoreDetached: false,
    	details: false,
    };

    const onChange = (object, onChange, options = {}) => {
    	options = {
    		...defaultOptions,
    		...options,
    	};

    	const proxyTarget = Symbol('ProxyTarget');
    	const {equals, isShallow, ignoreDetached, details} = options;
    	const cache = new Cache(equals);
    	const hasOnValidate = typeof options.onValidate === 'function';
    	const smartClone = new SmartClone(hasOnValidate);

    	// eslint-disable-next-line max-params
    	const validate = (target, property, value, previous, applyData) => !hasOnValidate
    		|| smartClone.isCloning
    		|| options.onValidate(path.concat(cache.getPath(target), property), value, previous, applyData) === true;

    	const handleChangeOnTarget = (target, property, value, previous) => {
    		if (
    			!ignoreProperty(cache, options, property)
    			&& !(ignoreDetached && cache.isDetached(target, object))
    		) {
    			handleChange(cache.getPath(target), property, value, previous);
    		}
    	};

    	// eslint-disable-next-line max-params
    	const handleChange = (changePath, property, value, previous, applyData) => {
    		if (smartClone.isCloning) {
    			smartClone.update(changePath, property, previous);
    		} else {
    			onChange(path.concat(changePath, property), value, previous, applyData);
    		}
    	};

    	const getProxyTarget = value => value
    		? (value[proxyTarget] || value)
    		: value;

    	const prepareValue = (value, target, property, basePath) => {
    		if (
    			isBuiltinWithoutMutableMethods(value)
    			|| property === 'constructor'
    			|| (isShallow && !SmartClone.isHandledMethod(target, property))
    			|| ignoreProperty(cache, options, property)
    			|| cache.isGetInvariant(target, property)
    			|| (ignoreDetached && cache.isDetached(target, object))
    		) {
    			return value;
    		}

    		if (basePath === undefined) {
    			basePath = cache.getPath(target);
    		}

    		return cache.getProxy(value, path.concat(basePath, property), handler, proxyTarget);
    	};

    	const handler = {
    		get(target, property, receiver) {
    			if (isSymbol(property)) {
    				if (property === proxyTarget || property === TARGET) {
    					return target;
    				}

    				if (
    					property === UNSUBSCRIBE
    					&& !cache.isUnsubscribed
    					&& cache.getPath(target).length === 0
    				) {
    					cache.unsubscribe();
    					return target;
    				}
    			}

    			const value = isBuiltinWithMutableMethods(target)
    				? Reflect.get(target, property)
    				: Reflect.get(target, property, receiver);

    			return prepareValue(value, target, property);
    		},

    		set(target, property, value, receiver) {
    			value = getProxyTarget(value);

    			const reflectTarget = target[proxyTarget] || target;
    			const previous = reflectTarget[property];

    			if (equals(previous, value) && property in target) {
    				return true;
    			}

    			const isValid = validate(target, property, value, previous);

    			if (
    				isValid
    				&& cache.setProperty(reflectTarget, property, value, receiver, previous)
    			) {
    				handleChangeOnTarget(target, property, target[property], previous);

    				return true;
    			}

    			return !isValid;
    		},

    		defineProperty(target, property, descriptor) {
    			if (!cache.isSameDescriptor(descriptor, target, property)) {
    				const previous = target[property];

    				if (
    					validate(target, property, descriptor.value, previous)
    					&& cache.defineProperty(target, property, descriptor, previous)
    				) {
    					handleChangeOnTarget(target, property, descriptor.value, previous);
    				}
    			}

    			return true;
    		},

    		deleteProperty(target, property) {
    			if (!Reflect.has(target, property)) {
    				return true;
    			}

    			const previous = Reflect.get(target, property);
    			const isValid = validate(target, property, undefined, previous);

    			if (
    				isValid
    				&& cache.deleteProperty(target, property, previous)
    			) {
    				handleChangeOnTarget(target, property, undefined, previous);

    				return true;
    			}

    			return !isValid;
    		},

    		apply(target, thisArg, argumentsList) {
    			const thisProxyTarget = thisArg[proxyTarget] || thisArg;

    			if (cache.isUnsubscribed) {
    				return Reflect.apply(target, thisProxyTarget, argumentsList);
    			}

    			if (
    				(details === false
    					|| (details !== true && !details.includes(target.name)))
    				&& SmartClone.isHandledType(thisProxyTarget)
    			) {
    				let applyPath = path.initial(cache.getPath(target));
    				const isHandledMethod = SmartClone.isHandledMethod(thisProxyTarget, target.name);

    				smartClone.start(thisProxyTarget, applyPath, argumentsList);

    				let result = Reflect.apply(
    					target,
    					smartClone.preferredThisArg(target, thisArg, thisProxyTarget),
    					isHandledMethod
    						? argumentsList.map(argument => getProxyTarget(argument))
    						: argumentsList,
    				);

    				const isChanged = smartClone.isChanged(thisProxyTarget, equals);
    				const previous = smartClone.stop();

    				if (SmartClone.isHandledType(result) && isHandledMethod) {
    					if (thisArg instanceof Map && target.name === 'get') {
    						applyPath = path.concat(applyPath, argumentsList[0]);
    					}

    					result = cache.getProxy(result, applyPath, handler);
    				}

    				if (isChanged) {
    					const applyData = {
    						name: target.name,
    						args: argumentsList,
    						result,
    					};
    					const changePath = smartClone.isCloning
    						? path.initial(applyPath)
    						: applyPath;
    					const property = smartClone.isCloning
    						? path.last(applyPath)
    						: '';

    					if (validate(path.get(object, changePath), property, thisProxyTarget, previous, applyData)) {
    						handleChange(changePath, property, thisProxyTarget, previous, applyData);
    					} else {
    						smartClone.undo(thisProxyTarget);
    					}
    				}

    				if (
    					(thisArg instanceof Map || thisArg instanceof Set)
    					&& isIterator(result)
    				) {
    					return wrapIterator(result, target, thisArg, applyPath, prepareValue);
    				}

    				return result;
    			}

    			return Reflect.apply(target, thisArg, argumentsList);
    		},
    	};

    	const proxy = cache.getProxy(object, options.pathAsArray ? [] : '', handler);
    	onChange = onChange.bind(proxy);

    	if (hasOnValidate) {
    		options.onValidate = options.onValidate.bind(proxy);
    	}

    	return proxy;
    };

    onChange.target = proxy => (proxy && proxy[TARGET]) || proxy;
    onChange.unsubscribe = proxy => proxy[UNSUBSCRIBE] || proxy;

    class DivComponent {
        constructor() {
            this.el = document.createElement('div');
        }

        render() {
            this.el;
        }
    }

    class Header extends DivComponent{
        constructor(appState) {
            super();
            this.appState = appState;
        }

        render() {
            this.el.classList.add('header');
            this.el.innerHTML = `
            <div>
                <img src="./static/logo.svg" alt="логотип" />
            </div>
            <div class="menu">
                <a class="menu__item" href="#">
                <img src="./static/search.svg" alt="Поиск иконка" />
                Поиск книг
                </a>
                <a class="menu__item" href="#favorites">
                    <img src="./static/favorites.svg" alt="Избранное иконка" />
                    Избранное
                    <div class="menu__counter">
                        ${this.appState.favorites.length}
                    </div>
                </a>
            </div>
        `;
            return this.el;
        }
    }

    class AboutBook extends DivComponent {

        constructor(appState, bookState) {
            super();
            this.appState = appState;
            this.bookState = bookState;
        }

        #addToFavorites() {
            this.appState.favorites.push(this.bookState); 
        }

        #deleteFromFavorites() {
            this.appState.favorites = this.appState.favorites.filter(
                b => b.key !== this.bookState.key
            );
        }

        render() {
            this.el.classList.add('book');
            const existInFavorites = this.appState.favorites.find(
                b => b.key === this.bookState.key
            );
            
            this.el.innerHTML = `
            
            <div class="book__info">
                <div class="book__image">
                    <img src="https://covers.openlibrary.org/b/olid/${this.bookState.cover_edition_key}-M.jpg" alt="обложка" />
                </div>
                <div class="book__characters">
                    <div class="book__author">
                    Author: <span>${this.bookState.author_name ? this.bookState.author_name[0] : 'Not found'}</span>
                    </div>
                    <div class="book__category">
                        Category: <span>${this.bookState.subject ? this.bookState.subject[0] : 'Not found'}</span>
                    </div>
                    <div class="book__first-publication">
                        First publication: <span>${this.bookState.publish_year ? this.bookState.publish_year[0] : 'Not found'}</span>
                    </div>
                    <div class="book__pages">
                        Number of pages: <span>${this.bookState.number_of_pages_median ? this.bookState.number_of_pages_median : 'Not found'}</span>
                    </div>
                    <button class="button_add-book ${existInFavorites ? 'button_active-book' : ''}">
                        ${existInFavorites
                            ? 'Remove from favorites'
                            : 'Add to favorites' 
                        }
                    </button>
                </div>
                
            </div>
            <p>Description:</p>
            <div class="book__description">
                Text of description
            </div>
            <p>Tags:</p> 
            <div class="book__tags">
            </div> 
        `;

            const tagsBlock = this.el.querySelector('.book__tags');
            const tags = this.bookState.subject;
            if(tags) {
                for (const tag of tags) {
                    const el = document.createElement('span');
                    el.innerHTML = tag;
                    tagsBlock.append(el);    
                }
            }
            
            if(existInFavorites) {
                this.el.querySelector('button').addEventListener('click', this.#deleteFromFavorites.bind(this));
            } else {
                this.el.querySelector('button').addEventListener('click', this.#addToFavorites.bind(this));
            }

          
            return this.el;
        }
    }

    class BookDescriptionView extends AbstractView {

        //state не нужно, тк все состояние стоит appState в app.js
        constructor(appState) {
            super();
            this.appState = appState;        
            this.appState = onChange(this.appState, this.appStateHook.bind(this));
            this.setTitle('О книге');
        }

        destroy() {
            onChange.unsubscribe(this.appState);
        }

        appStateHook(path) {
            if (path === 'favorites') {
                this.render();
            }
        }

        render() {
            const main = document.createElement('div');
            main.innerHTML = `
            <h1>
                ${this.appState.selectedBook.title}
            </h1>
        `;
            main.append(new AboutBook(this.appState, this.appState.selectedBook).render());
            this.app.innerHTML = '';
            this.app.append(main);
            this.renderHeader();
        }

        renderHeader() {
            const header = new Header(this.appState).render();
            this.app.prepend(header);
        }
    }

    class Card extends DivComponent{
        constructor(appState, cardState) {
            super();
            this.appState = appState;
            this.cardState = cardState; 
        }

        #addToFavorites(event) {
            event.stopPropagation();
            this.appState.favorites.push(this.cardState);
            localStorage.setItem(this.cardState.key.replace('/works/', ''), JSON.stringify(this.cardState));
        }

        #deleteFromFavorites(event) {
            event.stopPropagation();
            this.appState.favorites = this.appState.favorites.filter(
                b => b.key !== this.cardState.key
            );
            localStorage.removeItem(this.cardState.key);
        }

        href(event) {     
            if (event.target.nodeName === 'BUTTON') return false;
            if(this.appState.selectedBook.length) this.appState.selectedBook.pop();
            this.appState.selectedBook = this.cardState;
            window.location.href = '#book-description';
        }

        render() {
            this.el.classList.add('card');
            const existInFavorites = this.appState.favorites.find(
                b => b.key === this.cardState.key
            );
            
            this.el.innerHTML = `
            <div class="card__image">
                <img src="https://covers.openlibrary.org/b/olid/${this.cardState.cover_edition_key}-M.jpg" alt="обложка" />
            </div>
            <div class="card__info">
                <div class="card__tag">
                    ${this.cardState.subject ? this.cardState.subject[0] : 'Не задано'}
                </div>
                <div class="card__name">
                    ${this.cardState.title}
                </div>
                <div class="card__author">
                    ${this.cardState.author_name ? this.cardState.author_name[0] : 'Не задано'}
                </div>
                <div class="card__footer">
                    <button class="button_add ${existInFavorites ? 'button__active' : ''}">
                        ${existInFavorites
                            ? '<img src="./static/favorites.svg" />'
                            : '<img src="./static/favorites-white.svg" />' 
                        }
                    </button>
                </div>
            </div>

            
        `;
            //   add/remove button
            if(existInFavorites) {
                this.el.querySelector('button').addEventListener('click', this.#deleteFromFavorites.bind(this));
            } else {
                this.el.querySelector('button').addEventListener('click', this.#addToFavorites.bind(this));
            }
            //   link to book details
            this.el.addEventListener('click', this.href.bind(this));

            return this.el;
        }
    }

    class CardList extends DivComponent{
        constructor(appState, parentState) {
            super();
            this.appState = appState;
            this.parentState = parentState; //parentState - это состояние родительского элемента
        }

        render() {
            // sessionStorage.setItem('lastSearch', JSON.stringify(this.parentState));
            console.log(this.parentState);
            
            if(this.parentState.loading) {
                this.el.innerHTML = `<div class="card-list__loader">Загрузка...</div>`;
                return this.el;
            }

            
            console.log(this.parentState);

            this.el.classList.add('card-list');
            
            const cardGrid = document.createElement('div');
            cardGrid.classList.add('card_grid');
            this.el.append(cardGrid);
            for (const card of this.parentState.list) {
                cardGrid.append(new Card(this.appState, card).render());
            }
            
            return this.el;
        }
    }

    class FavoritesView extends AbstractView {

        //state не нужно, тк все состояние стоит appState в app.js
        constructor(appState) {
            super();
            this.appState = appState;
            this.appState = onChange(this.appState, this.appStateHook.bind(this));
            this.setTitle('Мои книги');
        }

        destroy() {
            onChange.unsubscribe(this.appState);
        }

        appStateHook(path) {
            if (path === 'favorites') {

                this.render();
            }
        }

        render() {
            const main = document.createElement('div');
            main.innerHTML = `
            <h1>
                Избранное
            </h1>
        `;
            main.append(new CardList(this.appState, { list: this.appState.favorites }).render());
            this.app.innerHTML = '';
            this.app.append(main);
            this.renderHeader();
        }

        renderHeader() {
            const header = new Header(this.appState).render();
            this.app.prepend(header);
        }
    }

    class Search extends DivComponent{
        constructor(state) {
            super();
            this.state = state;
        }

        search() {
            const value = this.el.querySelector('input').value;
            this.state.searchQuery = value;
        } 

        render() {
            this.el.classList.add('search');
            this.el.innerHTML = `
            <div class="search__wrapper">
                <input 
                    type="text" 
                    placeholder="Найти книгу или автора...."
                    class="search__input"
                    value="${this.state.searchQuery ? this.state.searchQuery : ''}"
                />
                <img src="./static/search.svg" alt="иконка поиска" />
            </div>
            <button aria-label="Искать"> 
                <img src="./static/search-white.svg" alt="иконка поиска" />
            </button>
        `;
            this.el.querySelector('button').addEventListener('click', this.search.bind(this));
            this.el.querySelector('input').addEventListener('keydown', (event) => {
                if(event.code === 'Enter') {
                    this.search();   //тк стрелочная функция, баиндить не нужно
                }
            });
            return this.el;
        }
    }

    class Pagination extends DivComponent{
        constructor(state) {
            super();
            // this.appState = appState;
            this.state = state; 
        }

        #next() {
          
            let end = this.state.end;
            const start = end;
            end = start + 9;
           

            if (start > 99) {
                const newOffset = this.state.offset + 100;

                if(newOffset > this.state.numFound) return;

                this.state.offset = newOffset;
                this.state.end = this.state.docs.length > 10 ? 9 : this.state.docs.length;
                this.state.start = 0;
                return;
            }

            if (end < this.state.docs.length) {
                this.state.end = end;
                this.state.start = start;
                
            } else {
                this.state.end = this.state.docs.length;
                this.state.start = start;
            }
            this.state.list = this.state.docs.slice(this.state.start, this.state.end);
            sessionStorage.setItem('lastSearch', JSON.stringify(this.state));
            console.log(this.state);

            // console.log(this.state.list, this.state.start, this.state.end);
        }
        
        #prev() {
            // console.log(this.state.offset);

            let end = this.state.start;
            const start = end - 9;
            // end = start + 9;
            if (start < 0) {
               
                const newOffset = this.state.offset - 100;
                if(newOffset < 0) return;
                this.state.offset = newOffset;
                this.state.end = 99;
                this.state.start = 90;
                
                return;
            } else {
                this.state.end = end;
                this.state.start = start;
            }

            if (end < this.state.docs.length) {
                this.state.end = end;
                this.state.start = start;
                
            } else {
                this.state.start = start;
                this.state.end = this.state.docs.length - 1;
            }
            this.state.list = this.state.docs.slice(this.state.start, this.state.end);
            sessionStorage.setItem('lastSearch', JSON.stringify(this.state));
            console.log(this.state);
          
        }

        render() {
           
            if (!this.state.list.length) {
                return '';
            }

            this.el.classList.add('pagination');
            this.el.innerHTML = `
                <button class="pagination_prev">
                    <img src="./static/arrow_back.svg" />
                    Предыдущая страница
                </button>
                <button class="pagination_next">
                    Следующая страница
                    <img src="./static/arrow_next.svg" />
                </button>
        `;
            this.el.querySelectorAll('button')[0].addEventListener('click', this.#prev.bind(this));
            this.el.querySelectorAll('button')[1].addEventListener('click', this.#next.bind(this));
             sessionStorage.setItem('lastSearch', JSON.stringify(this.state));
            return this.el;
        }
    }

    class MainView extends AbstractView {
        state = sessionStorage.getItem('lastSearch') != undefined ?  JSON.parse(sessionStorage.getItem('lastSearch')) : {
            list: [],
            numFound: 0,
            loading: false, 
            searchQuery: undefined,
            offset: 0,
            docs: [],
            start: 0,
            end: 9
        };

        constructor(appState) {
            super();
            this.appState = appState;
            this.appState = onChange(this.appState, this.appStateHook.bind(this));
            this.state = onChange(this.state, this.stateHook.bind(this));
            this.setTitle('Поиск книг');
        }

        destroy() {
            onChange.unsubscribe(this.appState);
            onChange.unsubscribe(this.state);
        }

        appStateHook(path) {
            if (path === 'favorites') {
                this.render();
            }
        }

        async stateHook(path) {
            if (path === 'searchQuery' || path === 'offset') {
                this.state.loading = true;
                const data = await this.loadList(this.state.searchQuery, this.state.offset, this.state.start);
                this.state.loading = false;
                this.state.numFound = data.numFound;  
                this.state.docs = data.docs;
                this.state.list = this.state.docs.slice(this.state.start, this.state.end);
                console.log(this.state);
                
                
            }

            if (path === 'list' || path === 'loading' || path === 'start' ) {
                this.render();
            }
        }

        async loadList(q, offset, start) {
            const res = await fetch(`https://openlibrary.org/search.json?q=${q}&offset=${offset}&start=${start}`);
            return res.json();
        }

        render() {
            console.log('before render');
            console.log(sessionStorage.length);

            const main = document.createElement('div');
            main.innerHTML = `
            <h1>
                Найдено книг - ${this.state.numFound}
            </h1>
        `;
            main.append(new Search(this.state).render());
            main.append(new CardList(this.appState, this.state).render());
            main.append(new Pagination(this.state).render());
            this.app.innerHTML = '';
            this.app.append(main);
            this.renderHeader();

        }

        renderHeader() {
            const header = new Header(this.appState).render();
            this.app.prepend(header);
        }
    }

    class App {
        routes = [
            {path: "", view: MainView},
            {path: "#favorites", view: FavoritesView},
            {path: "#book-description", view: BookDescriptionView}

        ];
        appState = {
            favorites: [],
            selectedBook: []
        }
        constructor() {
            window.addEventListener('hashchange', this.route.bind(this));
            for (const key of Object.keys(localStorage)) {
                this.appState.favorites.push(JSON.parse(localStorage.getItem(key)));
            }
            this.route();
        }

        route() {
            if (this.currentView) {
                this.currentView.destroy();
            }
            const view = this.routes.find(r => r.path == location.hash).view;
            this.currentView = new view(this.appState);
            this.currentView.render();
        }
    }

    new App();

})();
