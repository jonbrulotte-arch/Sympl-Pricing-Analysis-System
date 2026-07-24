export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  weight: number;
}

export type DimensionSourceType = "SHIPPING" | "UPC" | "DUNNAGE_FALLBACK" | "NONE";

export interface ResolvedDimensions {
  dimensions: PackageDimensions | null;
  source: DimensionSourceType;
  dunnageApplied: boolean;
  dunnagePercent: number;
}

interface ProductDimensions {
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  shippingLength?: number | null;
  shippingWidth?: number | null;
  shippingHeight?: number | null;
  shippingWeight?: number | null;
}

const BASELINE_BOX: PackageDimensions = {
  length: 12,
  width: 12,
  height: 12,
  weight: 1,
};

const CARRIER_DIVISORS: Record<string, number> = {
  UPS: 139,
  USPS: 166,
};

const UPS_CUBIC_FOOT_THRESHOLD = 1728;

function hasAllDimensions(
  l?: number | null,
  w?: number | null,
  h?: number | null,
  wt?: number | null
): boolean {
  return l != null && w != null && h != null && wt != null;
}

export function resolveDimensions(
  product: ProductDimensions,
  useShippingDimensions: boolean,
  dunnagePercent: number
): ResolvedDimensions {
  if (
    useShippingDimensions &&
    hasAllDimensions(
      product.shippingLength,
      product.shippingWidth,
      product.shippingHeight,
      product.shippingWeight
    )
  ) {
    return {
      dimensions: {
        length: product.shippingLength!,
        width: product.shippingWidth!,
        height: product.shippingHeight!,
        weight: product.shippingWeight!,
      },
      source: "SHIPPING",
      dunnageApplied: false,
      dunnagePercent: 0,
    };
  }

  if (
    hasAllDimensions(
      product.length,
      product.width,
      product.height,
      product.weight
    )
  ) {
    return {
      dimensions: {
        length: product.length!,
        width: product.width!,
        height: product.height!,
        weight: product.weight!,
      },
      source: "UPC",
      dunnageApplied: false,
      dunnagePercent: 0,
    };
  }

  if (dunnagePercent > 0) {
    const dims = applyDunnage(BASELINE_BOX, dunnagePercent);
    return {
      dimensions: dims,
      source: "DUNNAGE_FALLBACK",
      dunnageApplied: true,
      dunnagePercent,
    };
  }

  return {
    dimensions: null,
    source: "NONE",
    dunnageApplied: false,
    dunnagePercent: 0,
  };
}

export function applyDunnage(
  dims: PackageDimensions,
  dunnagePercent: number
): PackageDimensions {
  const factor = 1 + dunnagePercent / 100;
  return {
    length: dims.length * factor,
    width: dims.width * factor,
    height: dims.height * factor,
    weight: dims.weight,
  };
}

export function calculateDimensionalWeight(
  dims: PackageDimensions,
  carrier: "UPS" | "USPS",
  divisorOverride?: number
): {
  dimensionalWeight: number;
  billedWeight: number;
  divisorUsed: number;
} {
  const divisor = divisorOverride ?? CARRIER_DIVISORS[carrier];
  const volume = dims.length * dims.width * dims.height;
  const dimensionalWeight = volume / divisor;

  // UPS 1-cubic-foot exception: if volume <= 1728 cu in, use actual weight
  if (carrier === "UPS" && volume <= UPS_CUBIC_FOOT_THRESHOLD) {
    return {
      dimensionalWeight,
      billedWeight: dims.weight,
      divisorUsed: divisor,
    };
  }

  const billedWeight = Math.max(dimensionalWeight, dims.weight);

  return {
    dimensionalWeight,
    billedWeight,
    divisorUsed: divisor,
  };
}
