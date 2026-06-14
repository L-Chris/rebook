import { isName, isStream, PdfColor, PdfDeviceColorSpace, PdfError, PdfImageColorSpace, PdfImageData, PdfIndexedColorSpace, PdfPrimitive } from '../types'

export type PdfImageDecode = number[]
export type PdfImageColorKeyMask = number[]

type PdfPrimitiveResolver = (value: PdfPrimitive | undefined) => PdfPrimitive | undefined

export const readImageColorSpace = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver = identityResolve): PdfImageColorSpace => {
  const colorSpace = readOptionalDeviceColorSpace(value, resolve)
  if (colorSpace) return colorSpace
  const indexed = readIndexedColorSpace(value, resolve)
  if (indexed) return indexed
  throw new PdfError('Only DeviceRGB, DeviceGray, DeviceCMYK, and Indexed images are supported')
}

export const readOptionalDeviceColorSpace = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver = identityResolve): PdfDeviceColorSpace | undefined => {
  const resolved = resolve(value)
  if (isName(resolved, 'DeviceRGB') || isName(resolved, 'RGB')) return 'DeviceRGB'
  if (isName(resolved, 'DeviceGray') || isName(resolved, 'G')) return 'DeviceGray'
  if (isName(resolved, 'DeviceCMYK') || isName(resolved, 'CMYK')) return 'DeviceCMYK'
  if (!Array.isArray(resolved)) return undefined
  const family = resolve(resolved[0])
  if (isName(family, 'DeviceRGB') || isName(family, 'RGB') || isName(family, 'CalRGB')) return 'DeviceRGB'
  if (isName(family, 'DeviceGray') || isName(family, 'G') || isName(family, 'CalGray')) return 'DeviceGray'
  if (isName(family, 'DeviceCMYK') || isName(family, 'CMYK')) return 'DeviceCMYK'
  if (isName(family, 'ICCBased')) return iccBasedColorSpace(resolve(resolved[1]), resolve)
  return undefined
}

export const supportsImageBits = (bitsPerComponent: number, colorSpace: PdfImageColorSpace): boolean => {
  if (bitsPerComponent === 8) return true
  if (bitsPerComponent !== 1 && bitsPerComponent !== 2 && bitsPerComponent !== 4) return false
  return colorSpace === 'DeviceGray' || colorSpace === 'DeviceRGB' || colorSpace === 'DeviceCMYK' || typeof colorSpace === 'object'
}

export const readImageDecode = (value: PdfPrimitive | undefined): PdfImageDecode | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length % 2 !== 0 || !value.every((item): item is number => typeof item === 'number')) {
    throw new PdfError('Image Decode array is malformed')
  }
  return value
}

export const readImageColorKeyMask = (value: PdfPrimitive | undefined, colorSpace: PdfImageColorSpace): PdfImageColorKeyMask | undefined => {
  if (value === undefined || isStream(value)) return undefined
  const components = colorKeyComponents(colorSpace)
  if (!Array.isArray(value) || value.length !== components * 2 || !value.every((item): item is number => typeof item === 'number')) {
    throw new PdfError('Image Mask color-key array is malformed')
  }
  return value
}

export const imageSamplesToRgba = (
  samples: Uint8Array,
  width: number,
  height: number,
  colorSpace: PdfImageColorSpace,
  bitsPerComponent = 8,
  decode?: PdfImageDecode,
): Uint8ClampedArray => {
  if (bitsPerComponent === 1 || bitsPerComponent === 2 || bitsPerComponent === 4) return packedSamplesToRgba(samples, width, height, colorSpace, bitsPerComponent, decode)
  if (decode) return decodedSamplesToRgba(samples, width, height, colorSpace, bitsPerComponent, decode)
  const output = new Uint8ClampedArray(width * height * 4)
  if (typeof colorSpace === 'object') {
    const components = componentsPerPixel(colorSpace.base)
    const maxIndex = Math.min(colorSpace.highValue, Math.floor(colorSpace.lookup.byteLength / components) - 1)
    for (let source = 0, target = 0; target < output.length; source++, target += 4) {
      const index = Math.min(samples[source] ?? 0, maxIndex)
      writeColor(output, target, colorSpace.base, colorSpace.lookup, index * components)
    }
  } else if (colorSpace === 'DeviceRGB') {
    for (let source = 0, target = 0; target < output.length; source += 3, target += 4) {
      output[target] = samples[source] ?? 0
      output[target + 1] = samples[source + 1] ?? 0
      output[target + 2] = samples[source + 2] ?? 0
      output[target + 3] = 255
    }
  } else if (colorSpace === 'DeviceGray') {
    for (let source = 0, target = 0; target < output.length; source++, target += 4) {
      const gray = samples[source] ?? 0
      output[target] = gray
      output[target + 1] = gray
      output[target + 2] = gray
      output[target + 3] = 255
    }
  } else {
    for (let source = 0, target = 0; target < output.length; source += 4, target += 4) {
      const c = (samples[source] ?? 0) / 255
      const m = (samples[source + 1] ?? 0) / 255
      const y = (samples[source + 2] ?? 0) / 255
      const k = (samples[source + 3] ?? 0) / 255
      output[target] = Math.round((1 - Math.min(1, c + k)) * 255)
      output[target + 1] = Math.round((1 - Math.min(1, m + k)) * 255)
      output[target + 2] = Math.round((1 - Math.min(1, y + k)) * 255)
      output[target + 3] = 255
    }
  }
  return output
}

export const applyColorKeyMaskToRgba = (
  image: PdfImageData,
  samples: Uint8Array,
  colorSpace: PdfImageColorSpace,
  bitsPerComponent: number,
  mask: PdfImageColorKeyMask | undefined,
): PdfImageData => {
  if (!mask) return image
  const output = new Uint8ClampedArray(image.data)
  if (bitsPerComponent === 8) {
    const components = colorKeyComponents(colorSpace)
    for (let source = 0, target = 3; target < output.length; source += components, target += 4) {
      if (sampleMatchesColorKey(samples, source, components, mask)) output[target] = 0
    }
  } else {
    const components = colorKeyComponents(colorSpace)
    const rowBytes = Math.ceil((image.width * components * bitsPerComponent) / 8)
    for (let y = 0, target = 3; y < image.height; y++) {
      const rowOffset = y * rowBytes
      for (let x = 0; x < image.width; x++, target += 4) {
        if (sampleMatchesPackedColorKey(samples, rowOffset, x * components, components, bitsPerComponent, mask)) output[target] = 0
      }
    }
  }
  return {
    ...image,
    data: output,
  }
}

export const imageMaskSamplesToRgba = (samples: Uint8Array, width: number, height: number, decode?: PdfImageDecode): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(width * height * 4)
  const rowBytes = Math.ceil(width / 8)
  for (let y = 0, target = 0; y < height; y++) {
    const rowOffset = y * rowBytes
    for (let x = 0; x < width; x++, target += 4) {
      const bit = (samples[rowOffset + (x >> 3)] ?? 0) >> (7 - (x & 7)) & 1
      output[target + 3] = decode ? decodeComponentByte(bit, 1, decode, 0) : bit * 255
    }
  }
  return output
}

export const colorizeImageMask = (image: PdfImageData, color: PdfColor): PdfImageData => {
  if (!image.imageMask) return image
  const output = new Uint8ClampedArray(image.data.length)
  const r = colorByte(color[0])
  const g = colorByte(color[1])
  const b = colorByte(color[2])
  for (let target = 0; target < output.length; target += 4) {
    output[target] = r
    output[target + 1] = g
    output[target + 2] = b
    output[target + 3] = image.data[target + 3]
  }
  return {
    width: image.width,
    height: image.height,
    bitsPerComponent: image.bitsPerComponent,
    colorSpace: 'DeviceRGB',
    data: output,
  }
}

export const applySoftMaskToRgba = (image: PdfImageData, softMask: PdfImageData): PdfImageData => {
  return applyAlphaMaskToRgba(image, softMask, 0, true)
}

export const applyStencilMaskToRgba = (image: PdfImageData, mask: PdfImageData): PdfImageData => {
  return applyAlphaMaskToRgba(image, mask, 3, false)
}

const applyAlphaMaskToRgba = (image: PdfImageData, mask: PdfImageData, maskChannelOffset: number, softMask: boolean): PdfImageData => {
  if (image.width !== mask.width || image.height !== mask.height) {
    throw new PdfError('Image mask dimensions must match image dimensions')
  }
  const output = new Uint8ClampedArray(image.data)
  for (let target = 3, source = maskChannelOffset; target < output.length; target += 4, source += 4) {
    output[target] = Math.round((output[target] * (mask.data[source] ?? 0)) / 255)
  }
  return {
    ...image,
    ...(softMask ? { softMask: true } : {}),
    data: output,
  }
}

const decodedSamplesToRgba = (
  samples: Uint8Array,
  width: number,
  height: number,
  colorSpace: PdfImageColorSpace,
  bitsPerComponent: number,
  decode: PdfImageDecode,
): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(width * height * 4)
  const sampleMax = (1 << bitsPerComponent) - 1
  if (typeof colorSpace === 'object') {
    const components = componentsPerPixel(colorSpace.base)
    const maxIndex = Math.min(colorSpace.highValue, Math.floor(colorSpace.lookup.byteLength / components) - 1)
    for (let source = 0, target = 0; target < output.length; source++, target += 4) {
      const index = decodeIndex(samples[source] ?? 0, sampleMax, decode, maxIndex)
      writeColor(output, target, colorSpace.base, colorSpace.lookup, index * components)
    }
    return output
  }
  const components = componentsPerPixel(colorSpace)
  const decoded = new Uint8Array(components)
  for (let source = 0, target = 0; target < output.length; source += components, target += 4) {
    for (let component = 0; component < components; component++) decoded[component] = decodeComponentByte(samples[source + component] ?? 0, sampleMax, decode, component)
    writeColor(output, target, colorSpace, decoded, 0)
  }
  return output
}

const packedSamplesToRgba = (
  samples: Uint8Array,
  width: number,
  height: number,
  colorSpace: PdfImageColorSpace,
  bitsPerComponent: number,
  decode?: PdfImageDecode,
): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(width * height * 4)
  const sampleMax = (1 << bitsPerComponent) - 1
  if (typeof colorSpace === 'object') {
    const rowBytes = Math.ceil((width * bitsPerComponent) / 8)
    const components = componentsPerPixel(colorSpace.base)
    const maxIndex = Math.min(colorSpace.highValue, Math.floor(colorSpace.lookup.byteLength / components) - 1)
    for (let y = 0, target = 0; y < height; y++) {
      const rowOffset = y * rowBytes
      for (let x = 0; x < width; x++, target += 4) {
        const sample = readPackedSample(samples, rowOffset, x, bitsPerComponent)
        const index = decode ? decodeIndex(sample, sampleMax, decode, maxIndex) : Math.min(sample, maxIndex)
        writeColor(output, target, colorSpace.base, colorSpace.lookup, index * components)
      }
    }
    return output
  }
  const components = componentsPerPixel(colorSpace)
  const rowBytes = Math.ceil((width * components * bitsPerComponent) / 8)
  const decoded = new Uint8Array(components)
  for (let y = 0, target = 0; y < height; y++) {
    const rowOffset = y * rowBytes
    for (let x = 0; x < width; x++, target += 4) {
      const sampleBase = x * components
      for (let component = 0; component < components; component++) {
        const sample = readPackedSample(samples, rowOffset, sampleBase + component, bitsPerComponent)
        decoded[component] = decode ? decodeComponentByte(sample, sampleMax, decode, component) : Math.round((sample / sampleMax) * 255)
      }
      writeColor(output, target, colorSpace, decoded, 0)
    }
  }
  return output
}

const readPackedSample = (samples: Uint8Array, rowOffset: number, x: number, bitsPerComponent: number): number => {
  const bitOffset = x * bitsPerComponent
  const byte = samples[rowOffset + (bitOffset >> 3)] ?? 0
  const shift = 8 - bitsPerComponent - (bitOffset & 7)
  return byte >> shift & ((1 << bitsPerComponent) - 1)
}

const decodeIndex = (sample: number, sampleMax: number, decode: PdfImageDecode, maxIndex: number): number => {
  const [min, max] = decodePair(decode, 0, 0, maxIndex)
  return Math.max(0, Math.min(maxIndex, Math.round(min + (sample * (max - min)) / sampleMax)))
}

const decodeComponentByte = (sample: number, sampleMax: number, decode: PdfImageDecode, component: number): number => {
  const [min, max] = decodePair(decode, component, 0, 1)
  return Math.round(Math.max(0, Math.min(1, min + (sample * (max - min)) / sampleMax)) * 255)
}

const decodePair = (decode: PdfImageDecode, component: number, defaultMin: number, defaultMax: number): [number, number] => {
  const offset = component * 2
  return [decode[offset] ?? defaultMin, decode[offset + 1] ?? defaultMax]
}

const colorByte = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 255)

const sampleMatchesColorKey = (samples: Uint8Array, source: number, components: number, mask: PdfImageColorKeyMask): boolean => {
  for (let component = 0; component < components; component++) {
    const sample = samples[source + component] ?? 0
    if (sample < (mask[component * 2] ?? 0) || sample > (mask[component * 2 + 1] ?? 0)) return false
  }
  return true
}

const sampleMatchesPackedColorKey = (
  samples: Uint8Array,
  rowOffset: number,
  sampleBase: number,
  components: number,
  bitsPerComponent: number,
  mask: PdfImageColorKeyMask,
): boolean => {
  for (let component = 0; component < components; component++) {
    const sample = readPackedSample(samples, rowOffset, sampleBase + component, bitsPerComponent)
    if (sample < (mask[component * 2] ?? 0) || sample > (mask[component * 2 + 1] ?? 0)) return false
  }
  return true
}

const readIndexedColorSpace = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver): PdfIndexedColorSpace | undefined => {
  const resolved = resolve(value)
  if (!Array.isArray(resolved) || (!isName(resolve(resolved[0]), 'Indexed') && !isName(resolve(resolved[0]), 'I'))) return undefined
  const base = readOptionalDeviceColorSpace(resolved[1], resolve)
  const highValue = resolve(resolved[2])
  const lookup = lookupBytes(resolve(resolved[3]))
  if (!base || typeof highValue !== 'number' || !Number.isInteger(highValue) || highValue < 0 || !lookup) {
    throw new PdfError('Indexed image color space is malformed')
  }
  if (lookup.byteLength < (highValue + 1) * componentsPerPixel(base)) throw new PdfError('Indexed image lookup table is too short')
  return { type: 'Indexed', base, highValue, lookup }
}

const iccBasedColorSpace = (profile: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver): PdfDeviceColorSpace | undefined => {
  const dict = isStream(profile) ? profile.dict : isDictLike(profile) ? profile : undefined
  if (!dict) return undefined
  const alternate = readOptionalDeviceColorSpace(resolve(dict.entries.get('Alternate')), resolve)
  if (alternate) return alternate
  const components = resolve(dict.entries.get('N'))
  if (components === 1) return 'DeviceGray'
  if (components === 3) return 'DeviceRGB'
  if (components === 4) return 'DeviceCMYK'
  return undefined
}

const isDictLike = (value: PdfPrimitive | undefined): value is Extract<PdfPrimitive, { type: 'dict' }> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.type === 'dict')

const lookupBytes = (value: PdfPrimitive | undefined): Uint8Array | undefined => {
  if (typeof value === 'string') {
    const bytes = new Uint8Array(value.length)
    for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff
    return bytes
  }
  if (isStream(value)) return value.data
  return undefined
}

const componentsPerPixel = (colorSpace: PdfDeviceColorSpace): number => {
  if (colorSpace === 'DeviceRGB') return 3
  if (colorSpace === 'DeviceCMYK') return 4
  return 1
}

const colorKeyComponents = (colorSpace: PdfImageColorSpace): number =>
  typeof colorSpace === 'object' ? 1 : componentsPerPixel(colorSpace)

const identityResolve: PdfPrimitiveResolver = (value) => value

const writeColor = (output: Uint8ClampedArray, target: number, colorSpace: PdfDeviceColorSpace, samples: Uint8Array, source: number): void => {
  if (colorSpace === 'DeviceRGB') {
    output[target] = samples[source] ?? 0
    output[target + 1] = samples[source + 1] ?? 0
    output[target + 2] = samples[source + 2] ?? 0
  } else if (colorSpace === 'DeviceGray') {
    const gray = samples[source] ?? 0
    output[target] = gray
    output[target + 1] = gray
    output[target + 2] = gray
  } else {
    const c = (samples[source] ?? 0) / 255
    const m = (samples[source + 1] ?? 0) / 255
    const y = (samples[source + 2] ?? 0) / 255
    const k = (samples[source + 3] ?? 0) / 255
    output[target] = Math.round((1 - Math.min(1, c + k)) * 255)
    output[target + 1] = Math.round((1 - Math.min(1, m + k)) * 255)
    output[target + 2] = Math.round((1 - Math.min(1, y + k)) * 255)
  }
  output[target + 3] = 255
}
