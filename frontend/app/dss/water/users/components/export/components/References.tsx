import React from "react";
import { View, Text } from "@react-pdf/renderer";

const pdfStyles = {
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: "Times-Bold" as const,
    color: "#000000",
    marginTop: 18,
    marginBottom: 10,
    lineHeight: 1.3,
  },
  referenceText: {
    fontSize: 10,
    fontFamily: "Times-Roman" as const,
    marginBottom: 12,
    lineHeight: 1.5,
    color: "#000000",
    textAlign: "justify" as const,
  },
  pageNumber: {
    position: "absolute" as const,
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center" as const,
    fontSize: 10,
    fontFamily: "Times-Roman" as const,
    color: "#000000",
  },
};

export const References: React.FC = () => (
  <>
    <Text style={pdfStyles.sectionTitle}>References</Text>

    <Text style={pdfStyles.referenceText}>
      [1] Singh, P., Chaturvedi, R. K., Mishra, A., Kumari, L., Singh, R., Badruddin, I. A., Singh, S. N., Singh, S.,
      Sinha, V., Verma, P., Mishra, S., & Haritash, A. K. (2015). Assessment of ground and surface water quality along
      the river Varuna, Varanasi, India. Environmental Monitoring and Assessment, 187(4), 170.
      https://doi.org/10.1007/s10661-015-4405-9
    </Text>

    <Text style={pdfStyles.referenceText}>
      [2] Raju, N. J., Ram, P., & Dey, S. (2009). Groundwater quality in the lower Varuna River basin, Varanasi district,
      Uttar Pradesh. Journal of the Geological Society of India, 73(2), 178-192.
      https://doi.org/10.17491/jgsi/2009/73/62778
    </Text>

    <Text style={pdfStyles.referenceText}>
      [3] Athavale, R. N., Murti, C. S., & Chand, R. (1992). Estimation of recharge to the phreatic aquifers of the Lower
      Maner Basin, India, by using the tritium injection method. Journal of Hydrology, 107(1-4), 185-202.
      https://doi.org/10.1016/0022-1694(89)90056-8
    </Text>

    <Text style={pdfStyles.referenceText}>
      [4] Singh, V. P., & Woolhiser, D. A. (2002). Mathematical modeling of watershed hydrology. Journal of Hydrologic
      Engineering, 7(4), 270-292. https://doi.org/10.1061/(ASCE)1084-0699(2002)7:4(270)
    </Text>

    <Text style={pdfStyles.referenceText}>
      [5] Mishra, S. K., & Singh, V. P. (2003). Soil Conservation Service Curve Number (SCS-CN) Methodology. Dordrecht:
      Kluwer Academic Publishers. https://doi.org/10.1007/978-94-017-0147-1
    </Text>

    <Text style={pdfStyles.referenceText}>
      [6] Gorelick, N., Hancher, M., Dixon, M., Ilyushchenko, S., Thau, D., & Moore, R. (2017). Google Earth Engine:
      Planetary-scale geospatial analysis for everyone. Remote Sensing of Environment, 202, 18-27.
      https://doi.org/10.1016/j.rse.2017.06.031
    </Text>

    <Text style={pdfStyles.referenceText}>
      [7] Abatzoglou, J. T., Dobrowski, S. Z., Parks, S. A., & Hegewisch, K. C. (2018). TerraClimate, a high-resolution
      global dataset of monthly climate and climatic water balance from 1958-2015. Scientific Data, 5, 170191.
      https://doi.org/10.1038/sdata.2017.191
    </Text>

    <Text style={pdfStyles.referenceText}>
      [8] Running, S., Mu, Q., & Zhao, M. (2017). MOD16A2 MODIS/Terra Net Evapotranspiration 8-Day L4 Global 500m SIN
      Grid V006. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD16A2.006
    </Text>

    <Text style={pdfStyles.referenceText}>
      [9] Prakash, S., Mitra, A. K., Pai, D. S., & AghaKouchak, A. (2015). From TRMM to GPM: How well can heavy rainfall
      be detected from space? Advances in Water Resources, 88, 1-7. https://doi.org/10.1016/j.advwatres.2015.11.008
    </Text>

    <Text style={pdfStyles.referenceText}>
      [10] Roy, D. P., Li, J., Zhang, H. K., Yan, L., Huang, H., & Li, Z. (2016). Examination of Sentinel-2A multi-temporal
      data for land cover classification. International Journal of Applied Earth Observation and Geoinformation, 81, 52-64.
      https://doi.org/10.1016/j.jag.2019.05.001
    </Text>

    <Text style={pdfStyles.referenceText}>
      [11] Nistor, M. M., Ronchetti, F., Corsini, A., Cervi, F., & Borgatti, L. (2020). Soil water content index: A
      standardized method for assessing soil moisture anomalies. Hydrological Sciences Journal, 65(5), 746-758.
      https://doi.org/10.1080/02626667.2019.1706718
    </Text>

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);