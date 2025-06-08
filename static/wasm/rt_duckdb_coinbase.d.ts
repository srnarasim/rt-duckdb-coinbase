/* tslint:disable */
/* eslint-disable */
export function init_panic_hook(): void;
export function init_duckdb(): DuckDB;
export function start(): void;
export class DuckDB {
  free(): void;
  constructor(logger?: string | null, _worker?: string | null);
  instantiate(_main_module?: string | null, _pthread_worker?: string | null): DuckDB;
  connect(): DuckDBConnection;
}
export class DuckDBConnection {
  free(): void;
  constructor();
  query(sql: string): any;
  insert_values(table: string, values: any): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_duckdbconnection_free: (a: number, b: number) => void;
  readonly duckdbconnection_new: () => number;
  readonly duckdbconnection_query: (a: number, b: number, c: number) => [number, number, number];
  readonly duckdbconnection_insert_values: (a: number, b: number, c: number, d: any) => [number, number, number];
  readonly __wbg_duckdb_free: (a: number, b: number) => void;
  readonly duckdb_new: (a: number, b: number, c: number, d: number) => number;
  readonly duckdb_instantiate: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly duckdb_connect: (a: number) => [number, number, number];
  readonly init_panic_hook: () => void;
  readonly init_duckdb: () => number;
  readonly start: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly closure31_externref_shim: (a: number, b: number, c: any) => void;
  readonly _dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h95bdfa6f585c4ada: (a: number, b: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
