/**
 * @typedef {Object} PreviewItem
 * @property {string} name
 * @property {string} [path]
 * @property {string} [kind]
 * @property {number} [size]
 * @property {string|number|Date} [dateModified]
 * @property {string} [thumbnail]
 */

/**
 * @typedef {Object} PreviewApi
 * @property {(path: string) => string | null} getPreviewUrl
 * @property {(path: string) => Promise<{ content: string }>} fetchFileContent
 * @property {(path: string) => void} openEditor
 * @property {() => void} closePreview
 * @property {(path: string) => void} download
 */

/**
 * @typedef {Object} PreviewContext
 * @property {PreviewItem} item
 * @property {string} extension
 * @property {string | null} previewUrl
 * @property {PreviewManager} manager
 * @property {PreviewApi} api
 */

/**
 * @typedef {Object} PreviewAction
 * @property {string} id
 * @property {string} label
 * @property {(ctx: PreviewContext) => void | Promise<void>} run
 * @property {'primary' | 'default'} [variant]
 */

/**
 * @typedef {Object} PreviewPlugin
 * @property {string} id
 * @property {string} label
 * @property {number} [priority]
 * @property {(ctx: PreviewContext) => boolean} match
 * @property {() => Promise<any> | any} component
 * @property {(ctx: PreviewContext) => PreviewAction[] | void} [actions]
 * @property {(ctx: PreviewContext) => void} [onOpen]
 * @property {(ctx: PreviewContext) => void} [onClose]
 */

export {};
