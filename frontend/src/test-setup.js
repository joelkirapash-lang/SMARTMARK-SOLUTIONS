class RO { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = globalThis.ResizeObserver || RO;
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
window.print = () => {};
