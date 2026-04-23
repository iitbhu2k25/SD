import React from "react";
import { Text } from "@react-pdf/renderer";

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

    {[
      "[1] N. Gorelick, M. Hancher, M. Dixon, S. Ilyushchenko, D. Thau, and R. Moore, \"Google Earth Engine: Planetary-scale geospatial analysis for everyone,\" Remote Sensing of Environment, vol. 202, pp. 18-27, 2017. doi: https://doi.org/10.1016/j.rse.2017.06.031",
      "[2] R. N. Athavale, R. Rangarajan, and D. Muralidharan, \"Measurement of natural recharge in India,\" Journal Geological Society of India, vol. 39, no. 3, pp. 235-244, 1992.",
      "[3] J. T. Abatzoglou, S. Z. Dobrowski, S. A. Parks, and K. C. Hegewisch, \"TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance from 1958-2015,\" Scientific Data, vol. 5, p. 170191, 2018. doi: https://doi.org/10.1038/sdata.2017.191",
      "[4] S. W. Running, Q. Mu, M. Zhao, and A. Moreno, User's Guide MODIS Global Terrestrial Evapotranspiration (ET) Product (MOD16). NASA EOSDIS Land Processes DAAC, 2017. [Online]. Available: https://lpdaac.usgs.gov/documents/88/MOD16_User_Guide_V6.pdf",
      "[5] S. Prakash, A. K. Mitra, A. AghaKouchak, Z. Liu, H. Norouzi, and D. S. Pai, \"Remotely sensed precipitation indices for drought monitoring in Indian region,\" Advances in Space Research, vol. 57, no. 7, pp. 1555-1564, 2015. doi: https://doi.org/10.1016/j.asr.2015.12.010",
      "[6] D. P. Roy, G. E. Wukelic, J. R. Irons, D. B. Gesch, and C. Huang, \"Landsat-7 science data archive administration, packaging, validation, and distribution,\" Remote Sensing of Environment, vol. 185, pp. 6-16, 2016. doi: https://doi.org/10.1016/j.rse.2015.11.024",
      "[7] M. M. Nistor, P. K. Rai, V. Dugesar, V. N. Mishra, P. Singh, A. Arora, et al., \"Climate change effect on water resources in Varanasi district, India,\" Meteorological Applications, vol. 27, no. 1, p. e1863, 2020.",
    ].map((ref) => (
      <Text key={ref} style={pdfStyles.referenceText}>
        {ref}
      </Text>
    ))}

    <Text style={pdfStyles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
  </>
);
