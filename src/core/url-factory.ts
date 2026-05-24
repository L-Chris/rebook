/**
 * URL Factory interface.
 *
 * Abstracts blob URL creation and revocation, allowing parsers
 * to run in any environment.
 *
 * Implementations:
 * - Browser: wraps URL.createObjectURL / URL.revokeObjectURL
 * - Test: returns fake URLs or data: URIs
 */

/**
 * Data stored behind a generated resource URL.
 */
export interface ResourceURLData {
  data: string | ArrayBuffer | Blob
  mimeType: string
}

/**
 * Factory for creating and managing resource URLs.
 */
export interface URLFactory {
  /**
   * Create a URL for the given data.
   * @param data - The content (string, ArrayBuffer, or Blob)
   * @param mimeType - The MIME type (required for string/ArrayBuffer, optional for Blob)
   * @returns A URL string (e.g., blob: URL in browser, data: URI in tests)
   */
  createURL(data: string | ArrayBuffer | Blob, mimeType?: string): string

  /**
   * Revoke a previously created URL to free resources.
   */
  revokeURL(url: string): void

  /**
   * Return the original data for a generated URL when available.
   *
   * Exporters use this to package parser-created blob URLs back into files.
   */
  getData?(url: string): ResourceURLData | undefined
}
