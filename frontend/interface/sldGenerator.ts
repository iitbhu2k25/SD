import { ColorStop } from "@/interface/raster_operations";

export interface SLDGeneratorOptions {
  layerName: string;
  colorStops: ColorStop[];
  interpolation: "linear" | "discrete";
  opacity?: number;
  colorRampType?: "ramp" | "intervals" | "values";
  renderMode?: "singleband_pseudocolor" | "singleband_gray";
}

export interface ClassificationMethod {
  id: string;
  name: string;
  description: string;
}

export const CLASSIFICATION_METHODS: ClassificationMethod[] = [
  {
    id: "equal_interval",
    name: "Equal Interval",
    description: "Divides range into equal-sized intervals",
  },
  {
    id: "quantile",
    name: "Quantile",
    description: "Equal number of values in each class",
  },
  {
    id: "natural_breaks",
    name: "Natural Breaks (Jenks)",
    description: "Minimizes within-class variance",
  },
  {
    id: "standard_deviation",
    name: "Standard Deviation",
    description: "Classes based on standard deviations",
  },
  {
    id: "pretty_breaks",
    name: "Pretty Breaks",
    description: "Rounded, human-friendly breaks",
  },
];

/**
 * Generates SLD (Styled Layer Descriptor) XML for GeoServer raster styling
 */
export class SLDGenerator {
  /**
   * Generate complete SLD XML with proper GeoServer formatting
   */
  static generateSLD(options: SLDGeneratorOptions): string {
    const { layerName, colorStops, interpolation, opacity = 1 } = options;

    // Sort color stops by value
    const sortedStops = [...colorStops].sort((a, b) => a.value - b.value);

    const isDiscrete = interpolation === "discrete";
    const colorMapType = isDiscrete ? "intervals" : "ramp";

    // Generate base color entries
    let colorMapEntries = this.generateColorMapEntries(
      sortedStops,
      interpolation,
    );

    if (sortedStops.length > 0) {
      const maxValue = sortedStops[sortedStops.length - 1].value;

      // -------- RAMP: hide values above max --------
      if (colorMapType === "ramp") {
        const epsilon = Number.isInteger(maxValue) ? 1 : 0.0001;
        const hideValue = maxValue + epsilon;

        colorMapEntries += `
              <ColorMapEntry
                quantity="${hideValue}"
                color="#000000"
                opacity="0"
                label="Above max"/>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>${this.escapeXml(layerName)}</Name>
    <UserStyle>
      <Name>${this.escapeXml(layerName)}_style</Name>
      <Title>${isDiscrete ? "Classified" : "Continuous"} Raster Style</Title>
      <Abstract>Generated SLD for raster visualization</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Name>Raster</Name>
          <RasterSymbolizer>
            <Opacity>${opacity}</Opacity>
            <ColorMap type="${colorMapType}">
${colorMapEntries}
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;
  }

  static generateGraySLD(
    options: Pick<SLDGeneratorOptions, "layerName" | "opacity">,
  ): string {
    const { layerName, opacity = 1 } = options;

    return `<?xml version="1.0" encoding="UTF-8"?>
      <StyledLayerDescriptor version="1.0.0"
        xmlns="http://www.opengis.net/sld"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
        <NamedLayer>
          <Name>${this.escapeXml(layerName)}</Name>
          <UserStyle>
            <Name>${this.escapeXml(layerName)}_style</Name>
            <Title>Grayscale Raster Style</Title>
            <Abstract>Generated SLD for grayscale raster visualization</Abstract>
            <FeatureTypeStyle>
              <Rule>
                <Name>Raster</Name>
                <RasterSymbolizer>
                  <Opacity>${opacity}</Opacity>
                  <ChannelSelection>
                    <GrayChannel>
                      <SourceChannelName>1</SourceChannelName>
                      <ContrastEnhancement>
                        <Normalize/>
                      </ContrastEnhancement>
                    </GrayChannel>
                  </ChannelSelection>
                  <ColorMap type="ramp">
                    <ColorMapEntry color="#000000" quantity="0" label="Min" opacity="1"/>
                    <ColorMapEntry color="#ffffff" quantity="255" label="Max" opacity="1"/>
                  </ColorMap>
                </RasterSymbolizer>
              </Rule>
            </FeatureTypeStyle>
          </UserStyle>
        </NamedLayer>
      </StyledLayerDescriptor>`;
  }

  /**
   * Generate color map entries with proper formatting
   */
  private static generateColorMapEntries(
    stops: ColorStop[],
    interpolation: "linear" | "discrete",
  ): string {
    return stops
      .map((stop, index) => {
        const label = this.escapeXml(stop.label || stop.value.toFixed(2));
        // For discrete/intervals mode, add 1 to quantity to ensure rendering
        const quantity =
          interpolation === "discrete"
            ? (stop.value + 1).toFixed(6)
            : stop.value.toFixed(6);

        return `              <ColorMapEntry color="${stop.color}" quantity="${quantity}" label="${label}" opacity="1"/>`;
      })
      .join("\n");
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Generate color stops using a preset color scheme
   */
  static generateColorStops(
    min: number,
    max: number,
    numStops: number,
    colorScheme: string,
    customColors?: string[],
  ): ColorStop[] {
    const stops: ColorStop[] = [];
    const step = (max - min) / (numStops - 1);

    const colors = customColors || this.getColorScheme(colorScheme, numStops);

    for (let i = 0; i < numStops; i++) {
      const value = min + step * i;
      stops.push({
        id: `stop-${i}`,
        value: parseFloat(value.toFixed(6)),
        color: colors[i] || "#000000",
        label: value.toFixed(2),
      });
    }

    return stops;
  }

  /**
   * Generate color stops using classification methods
   */
  static generateClassifiedStops(
    values: number[],
    numClasses: number,
    method: string,
    colorScheme: string,
    customColors?: string[],
  ): ColorStop[] {
    let breaks: number[] = [];

    switch (method) {
      case "equal_interval":
        breaks = this.equalIntervalBreaks(values, numClasses);
        break;
      case "quantile":
        breaks = this.quantileBreaks(values, numClasses);
        break;
      case "natural_breaks":
        breaks = this.naturalBreaks(values, numClasses);
        break;
      case "standard_deviation":
        breaks = this.standardDeviationBreaks(values, numClasses);
        break;
      case "pretty_breaks":
        breaks = this.prettyBreaks(values, numClasses);
        break;
      default:
        breaks = this.equalIntervalBreaks(values, numClasses);
    }

    const colors =
      customColors || this.getColorScheme(colorScheme, breaks.length);

    return breaks.map((value, i) => ({
      id: `stop-${i}`,
      value: parseFloat(value.toFixed(6)),
      color: colors[i] || "#000000",
      label: value.toFixed(2),
    }));
  }

  /**
   * Equal interval classification
   */
  private static equalIntervalBreaks(
    values: number[],
    numClasses: number,
  ): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / numClasses;

    return Array.from({ length: numClasses + 1 }, (_, i) => min + step * i);
  }

  /**
   * Quantile classification
   */
  private static quantileBreaks(
    values: number[],
    numClasses: number,
  ): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const breaks: number[] = [sorted[0]];

    for (let i = 1; i < numClasses; i++) {
      const index = Math.floor((i / numClasses) * sorted.length);
      breaks.push(sorted[index]);
    }

    breaks.push(sorted[sorted.length - 1]);
    return breaks;
  }

  /**
   * Natural breaks (Jenks) classification
   * Simplified implementation
   */
  private static naturalBreaks(values: number[], numClasses: number): number[] {
    const sorted = [...values].sort((a, b) => a - b);

    if (sorted.length <= numClasses) {
      return sorted;
    }

    // Simplified Jenks algorithm
    const breaks: number[] = [sorted[0]];
    const step = Math.floor(sorted.length / numClasses);

    for (let i = 1; i < numClasses; i++) {
      const index = i * step;
      breaks.push(sorted[index]);
    }

    breaks.push(sorted[sorted.length - 1]);
    return breaks;
  }

  /**
   * Standard deviation classification
   */
  private static standardDeviationBreaks(
    values: number[],
    numClasses: number,
  ): number[] {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    const breaks: number[] = [];
    const halfClasses = Math.floor(numClasses / 2);

    for (let i = -halfClasses; i <= halfClasses; i++) {
      breaks.push(mean + i * stdDev);
    }

    return breaks.sort((a, b) => a - b);
  }

  /**
   * Pretty breaks - rounded, human-friendly values
   */
  private static prettyBreaks(values: number[], numClasses: number): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Calculate a nice round step
    const rawStep = range / numClasses;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalizedStep = rawStep / magnitude;

    let niceStep: number;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    const step = niceStep * magnitude;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;

    const breaks: number[] = [];
    for (let i = niceMin; i <= niceMax; i += step) {
      breaks.push(i);
    }

    return breaks;
  }

  /**
   * Get predefined color schemes (expanded for industrial use)
   */
  private static getColorScheme(scheme: string, numStops: number): string[] {
    const schemes: Record<string, string[]> = {
      sequential: [
        "#f7fbff",
        "#deebf7",
        "#c6dbef",
        "#9ecae1",
        "#6baed6",
        "#4292c6",
        "#2171b5",
        "#08519c",
        "#08306b",
      ],
      sequential_red: [
        "#fff5f0",
        "#fee0d2",
        "#fcbba1",
        "#fc9272",
        "#fb6a4a",
        "#ef3b2c",
        "#cb181d",
        "#a50f15",
        "#67000d",
      ],
      sequential_green: [
        "#f7fcf5",
        "#e5f5e0",
        "#c7e9c0",
        "#a1d99b",
        "#74c476",
        "#41ab5d",
        "#238b45",
        "#006d2c",
        "#00441b",
      ],
      diverging: [
        "#d73027",
        "#f46d43",
        "#fdae61",
        "#fee090",
        "#ffffbf",
        "#e0f3f8",
        "#abd9e9",
        "#74add1",
        "#4575b4",
      ],
      diverging_purple_green: [
        "#8e0152",
        "#c51b7d",
        "#de77ae",
        "#f1b6da",
        "#fde0ef",
        "#e6f5d0",
        "#b8e186",
        "#7fbc41",
        "#4d9221",
      ],
      rainbow: [
        "#9e0142",
        "#d53e4f",
        "#f46d43",
        "#fdae61",
        "#fee08b",
        "#e6f598",
        "#abdda4",
        "#66c2a5",
        "#3288bd",
        "#5e4fa2",
      ],
      terrain: [
        "#333399",
        "#6699CC",
        "#99CCFF",
        "#CCFFCC",
        "#FFFF99",
        "#FFCC66",
        "#FF9933",
        "#CC6633",
        "#993333",
      ],
      viridis: [
        "#440154",
        "#482777",
        "#3e4989",
        "#31688e",
        "#26828e",
        "#1f9e89",
        "#35b779",
        "#6ece58",
        "#b5de2b",
        "#fde724",
      ],
      plasma: [
        "#0d0887",
        "#46039f",
        "#7201a8",
        "#9c179e",
        "#bd3786",
        "#d8576b",
        "#ed7953",
        "#fb9f3a",
        "#fdca26",
        "#f0f921",
      ],
    };

    const schemeColors = schemes[scheme] || schemes.sequential;
    return this.interpolateColors(schemeColors, numStops);
  }

  /**
   * Interpolate colors to match required number of stops
   */
  private static interpolateColors(
    colors: string[],
    targetCount: number,
  ): string[] {
    if (colors.length === targetCount) return colors;

    if (colors.length > targetCount) {
      // Sample evenly
      const step = (colors.length - 1) / (targetCount - 1);
      return Array.from({ length: targetCount }, (_, i) => {
        const index = Math.round(i * step);
        return colors[index];
      });
    }

    // Interpolate between colors
    const result: string[] = [];
    const segmentSize = (targetCount - 1) / (colors.length - 1);

    for (let i = 0; i < targetCount; i++) {
      const segmentIndex = i / segmentSize;
      const startIndex = Math.floor(segmentIndex);
      const endIndex = Math.min(startIndex + 1, colors.length - 1);
      const t = segmentIndex - startIndex;

      if (t === 0 || startIndex === endIndex) {
        result.push(colors[startIndex]);
      } else {
        const interpolated = this.interpolateColor(
          colors[startIndex],
          colors[endIndex],
          t,
        );
        result.push(interpolated);
      }
    }

    return result;
  }

  /**
   * Interpolate between two hex colors
   */
  private static interpolateColor(
    color1: string,
    color2: string,
    t: number,
  ): string {
    const hex1 = color1.replace("#", "");
    const hex2 = color2.replace("#", "");

    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);

    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  /**
   * Invert color scheme
   */
  static invertColors(colorStops: ColorStop[]): ColorStop[] {
    return colorStops.map((stop) => ({
      ...stop,
      color: colorStops[colorStops.length - 1 - colorStops.indexOf(stop)].color,
    }));
  }

  /**
   * Validate color stops
   */
  static validateColorStops(stops: ColorStop[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (stops.length < 2) {
      errors.push("At least 2 color stops are required");
    }

    // Check for duplicate values
    const values = stops.map((s) => s.value);
    const uniqueValues = new Set(values);
    if (uniqueValues.size !== values.length) {
      errors.push("Duplicate values found in color stops");
    }

    // Validate hex colors
    stops.forEach((stop, index) => {
      if (!/^#[0-9A-Fa-f]{6}$/.test(stop.color)) {
        errors.push(`Invalid color format at stop ${index + 1}: ${stop.color}`);
      }
    });

    // Check for valid value range
    const sorted = [...stops].sort((a, b) => a.value - b.value);
    if (sorted.some((s) => !isFinite(s.value))) {
      errors.push("All values must be finite numbers");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
