import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfModel } from "./model";

// Ingen automatisk avstavning (den är anpassad för engelska).
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  logo: { maxWidth: 160, maxHeight: 70, objectFit: "contain" },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "right" },
  meta: { textAlign: "right", marginTop: 2 },
  twoCol: { flexDirection: "row", gap: 24, marginBottom: 14 },
  col: { flex: 1 },
  label: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  paragraph: { fontSize: 9.5, lineHeight: 1.35, marginBottom: 6 },
  table: { marginTop: 6, borderTopWidth: 1, borderTopColor: "#d1d5db" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  cDesc: { flex: 1, paddingRight: 6 },
  cArt: { width: 48 },
  cQty: { width: 44, textAlign: "right" },
  cUnit: { width: 34, paddingLeft: 4 },
  cPrice: { width: 64, textAlign: "right" },
  cAmount: { width: 72, textAlign: "right" },
  totals: { marginTop: 10, marginLeft: "auto", width: 250 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  strong: { fontFamily: "Helvetica-Bold", fontSize: 11, borderTopWidth: 1, borderTopColor: "#1f2937", paddingTop: 3, marginTop: 2 },
  note: { fontSize: 8, color: "#4b5563", marginTop: 4 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10 },
  visual: { marginTop: 8, maxHeight: 360, objectFit: "contain" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#6b7280", flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#d1d5db", paddingTop: 4 },
});

export interface PdfImages {
  logo: Buffer | null;
  visualization: Buffer | null;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={{ flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function QuoteDocument({ model, images }: { model: PdfModel; images: PdfImages }) {
  const c = model.company;
  return (
    <Document title={`Offert ${model.number}`} author={c.name} language="sv">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {images.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image har ingen alt-egenskap
              <Image style={styles.logo} src={{ data: images.logo, format: "png" }} />
            ) : (
              <Text style={styles.companyName}>{c.name}</Text>
            )}
          </View>
          <View>
            <Text style={styles.title}>Offert</Text>
            <Text style={styles.meta}>Offertnummer: {model.number}</Text>
            <Text style={styles.meta}>Datum: {model.date}</Text>
            <Text style={styles.meta}>
              Giltig till: {model.validUntil} ({model.validityDays} dagar)
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Kund</Text>
            <Text>{model.customer.name}</Text>
            {model.customer.address ? <Text>{model.customer.address}</Text> : null}
            {model.customer.phone ? <Text>Tel: {model.customer.phone}</Text> : null}
            {model.customer.email ? <Text>{model.customer.email}</Text> : null}
            {model.customer.propertyDesignation ? (
              <Text>Fastighetsbeteckning: {model.customer.propertyDesignation}</Text>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Från</Text>
            <Text>{c.name}</Text>
            {c.address ? <Text>{c.address}</Text> : null}
            {c.phone ? <Text>Tel: {c.phone}</Text> : null}
            {c.email ? <Text>{c.email}</Text> : null}
          </View>
        </View>

        {model.introText ? <Text style={styles.paragraph}>{model.introText}</Text> : null}

        {model.summary ? (
          <View>
            <Text style={styles.h2}>Arbetet i korthet</Text>
            <Text style={styles.paragraph}>{model.summary}</Text>
          </View>
        ) : null}

        <Text style={styles.h2}>Specifikation</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]} fixed>
            <Text style={styles.cDesc}>Beskrivning</Text>
            <Text style={styles.cArt}>Art.nr</Text>
            <Text style={styles.cQty}>Mängd</Text>
            <Text style={styles.cUnit}>Enhet</Text>
            <Text style={styles.cPrice}>À-pris, kr</Text>
            <Text style={styles.cAmount}>Belopp, kr</Text>
          </View>
          {model.rows.map((row, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={styles.cDesc}>{row.description}</Text>
              <Text style={styles.cArt}>{row.articleNumber}</Text>
              <Text style={styles.cQty}>{row.quantity}</Text>
              <Text style={styles.cUnit}>{row.unit}</Text>
              <Text style={styles.cPrice}>{row.unitPrice}</Text>
              <Text style={styles.cAmount}>{row.amount}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Belopp per rad exkl. moms och påslag. Priser exkl. moms om inget annat anges.</Text>

        <View style={styles.totals} wrap={false}>
          {model.summaryRows.map((row, i) => (
            <View key={i} style={[styles.totalRow, row.strong ? styles.strong : {}]}>
              <Text>{row.label}</Text>
              <Text>{row.value}</Text>
            </View>
          ))}
          {model.rotNote ? <Text style={styles.note}>{model.rotNote}</Text> : null}
        </View>

        {model.assumptions.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.h2}>Förutsättningar och antaganden</Text>
            <Bullets items={model.assumptions} />
          </View>
        ) : null}

        {model.exclusions.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.h2}>Ingår inte</Text>
            <Bullets items={model.exclusions} />
          </View>
        ) : null}

        <View wrap={false}>
          <Text style={styles.h2}>Villkor</Text>
          {model.termsText ? <Text style={styles.paragraph}>{model.termsText}</Text> : null}
          <Text style={styles.paragraph}>Betalningsvillkor: {c.paymentTerms}</Text>
          <Text style={styles.paragraph}>Offerten är giltig till och med {model.validUntil}.</Text>
          {c.fSkatt ? <Text style={styles.paragraph}>Vi innehar F-skattsedel.</Text> : null}
        </View>

        {model.closingText ? <Text style={[styles.paragraph, { marginTop: 10 }]}>{model.closingText}</Text> : null}

        {images.visualization ? (
          <View break>
            <Text style={styles.h2}>Visualisering</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image har ingen alt-egenskap */}
            <Image style={styles.visual} src={{ data: images.visualization, format: "jpg" }} />
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {c.name}
            {c.orgNumber ? ` · Org.nr ${c.orgNumber}` : ""}
            {c.fSkatt ? " · Godkänd för F-skatt" : ""}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Offert ${model.number} · Sida ${pageNumber} av ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
