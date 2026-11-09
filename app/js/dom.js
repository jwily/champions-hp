// Small DOM helpers shared by the modules.

export const $ = (selector, root = document) => root.querySelector(selector);

export const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text ?? '' });
