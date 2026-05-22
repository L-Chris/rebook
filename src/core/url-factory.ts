/**
 * URL Factory interface.
 *
 * Abstracts blob URL creation and revocation, allowing the EPUB parser
 * to run in any environment.
 *
 * Implementations:
 * - Browser: wraps URL.createObjectURL / URL.revokeObjectURL
 * - Test: returns fake URLs or data: URIs
 */

/**
 * Factory for creating and managing resource URLs.
 */
export interface URLFactory {
  /**
   * Create a URL for the given data.
   * @param data - The content (string or ArrayBuffer)
   * @param mimeType - The MIME type
   * @returns A URL string (e.g., blob: URL in browser, data: URI in tests)
   */
  createURL(data: string | ArrayBuffer, mimeType: string): string

  /**
   * Revoke a previously created URL to free resources.
   */
  revokeURL(url: string): void
}
