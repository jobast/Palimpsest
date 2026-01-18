export interface PageTemplate {
  id: string
  name: string
  description: string
  region: 'us' | 'fr' | 'uk' | 'digital' | 'manuscript'
  page: {
    width: string
    height: string
    marginTop: string
    marginBottom: string
    marginLeft: string
    marginRight: string
  }
  typography: {
    fontFamily: string
    fontSize: string
    lineHeight: number
    paragraphSpacing: string
    firstLineIndent: string
  }
  header?: {
    show: boolean
    content: string
    fontSize: string
  }
  footer?: {
    show: boolean
    showPageNumber: boolean
    fontSize: string
  }
}

export const defaultTemplates: PageTemplate[] = [
  // ===================
  // MANUSCRIPT FORMATS (for submission to agents/publishers)
  // ===================
  {
    id: 'manuscript-us',
    name: 'Manuscrit US Letter',
    description: 'Format soumission standard US (8.5" × 11")',
    region: 'manuscript',
    page: {
      width: '8.5in',
      height: '11in',
      marginTop: '1in',
      marginBottom: '1in',
      marginLeft: '1in',
      marginRight: '1in'
    },
    typography: {
      fontFamily: 'Times New Roman, Times, serif',
      fontSize: '12pt',
      lineHeight: 2.0, // Double-spaced
      paragraphSpacing: '0',
      firstLineIndent: '0.5in'
    },
    header: {
      show: true,
      content: '{author} / {title} / {page}',
      fontSize: '12pt'
    },
    footer: {
      show: false,
      showPageNumber: false,
      fontSize: '12pt'
    }
  },
  {
    id: 'manuscript-a4',
    name: 'Manuscrit A4',
    description: 'Format soumission Europe (210 × 297mm)',
    region: 'manuscript',
    page: {
      width: '210mm',
      height: '297mm',
      marginTop: '25mm',
      marginBottom: '25mm',
      marginLeft: '25mm',
      marginRight: '25mm'
    },
    typography: {
      fontFamily: 'Times New Roman, Times, serif',
      fontSize: '12pt',
      lineHeight: 2.0, // Double-spaced
      paragraphSpacing: '0',
      firstLineIndent: '1.25cm'
    },
    header: {
      show: true,
      content: '{author} / {title} / {page}',
      fontSize: '12pt'
    },
    footer: {
      show: false,
      showPageNumber: false,
      fontSize: '12pt'
    }
  },

  // ===================
  // US TRADE FORMATS
  // ===================
  {
    id: 'us-trade-6x9',
    name: 'US Trade 6×9',
    description: 'Format trade standard US (6" × 9")',
    region: 'us',
    page: {
      width: '6in',
      height: '9in',
      marginTop: '0.75in',
      marginBottom: '0.75in',
      marginLeft: '0.75in',
      marginRight: '0.75in'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.4,
      paragraphSpacing: '0',
      firstLineIndent: '0.3in'
    },
    header: {
      show: true,
      content: '{title}',
      fontSize: '9pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
  {
    id: 'us-trade-5.5x8.5',
    name: 'US Trade 5.5×8.5',
    description: 'Format trade compact US (5.5" × 8.5")',
    region: 'us',
    page: {
      width: '5.5in',
      height: '8.5in',
      marginTop: '0.7in',
      marginBottom: '0.7in',
      marginLeft: '0.7in',
      marginRight: '0.7in'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.35,
      paragraphSpacing: '0',
      firstLineIndent: '0.25in'
    },
    header: {
      show: true,
      content: '{title}',
      fontSize: '9pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
  {
    id: 'us-trade-5x8',
    name: 'US Trade 5×8',
    description: 'Format trade petit US (5" × 8")',
    region: 'us',
    page: {
      width: '5in',
      height: '8in',
      marginTop: '0.625in',
      marginBottom: '0.625in',
      marginLeft: '0.625in',
      marginRight: '0.625in'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '10.5pt',
      lineHeight: 1.35,
      paragraphSpacing: '0',
      firstLineIndent: '0.25in'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '8pt'
    }
  },
  {
    id: 'us-mass-market',
    name: 'US Mass Market',
    description: 'Format poche US (4.25" × 6.87")',
    region: 'us',
    page: {
      width: '4.25in',
      height: '6.87in',
      marginTop: '0.5in',
      marginBottom: '0.5in',
      marginLeft: '0.5in',
      marginRight: '0.5in'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '10pt',
      lineHeight: 1.3,
      paragraphSpacing: '0',
      firstLineIndent: '0.2in'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '8pt'
    }
  },

  // ===================
  // UK FORMATS
  // ===================
  {
    id: 'uk-a-format',
    name: 'UK A-Format',
    description: 'Petit poche britannique (178 × 111mm)',
    region: 'uk',
    page: {
      width: '111mm',
      height: '178mm',
      marginTop: '12mm',
      marginBottom: '12mm',
      marginLeft: '10mm',
      marginRight: '10mm'
    },
    typography: {
      fontFamily: 'Caslon, Georgia, serif',
      fontSize: '9.5pt',
      lineHeight: 1.3,
      paragraphSpacing: '0',
      firstLineIndent: '8mm'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '8pt'
    }
  },
  {
    id: 'uk-b-format',
    name: 'UK B-Format',
    description: 'Format standard britannique (198 × 129mm)',
    region: 'uk',
    page: {
      width: '129mm',
      height: '198mm',
      marginTop: '15mm',
      marginBottom: '15mm',
      marginLeft: '13mm',
      marginRight: '13mm'
    },
    typography: {
      fontFamily: 'Caslon, Georgia, serif',
      fontSize: '10.5pt',
      lineHeight: 1.35,
      paragraphSpacing: '0',
      firstLineIndent: '10mm'
    },
    header: {
      show: true,
      content: '{title}',
      fontSize: '9pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
  {
    id: 'uk-demy',
    name: 'UK Demy',
    description: 'Format Demy britannique (216 × 138mm)',
    region: 'uk',
    page: {
      width: '138mm',
      height: '216mm',
      marginTop: '18mm',
      marginBottom: '18mm',
      marginLeft: '15mm',
      marginRight: '15mm'
    },
    typography: {
      fontFamily: 'Baskerville, Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.4,
      paragraphSpacing: '0',
      firstLineIndent: '12mm'
    },
    header: {
      show: true,
      content: '{title}',
      fontSize: '9pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
  {
    id: 'uk-royal',
    name: 'UK Royal',
    description: 'Grand format britannique (234 × 156mm)',
    region: 'uk',
    page: {
      width: '156mm',
      height: '234mm',
      marginTop: '20mm',
      marginBottom: '20mm',
      marginLeft: '18mm',
      marginRight: '18mm'
    },
    typography: {
      fontFamily: 'Baskerville, Georgia, serif',
      fontSize: '11.5pt',
      lineHeight: 1.45,
      paragraphSpacing: '0',
      firstLineIndent: '12mm'
    },
    header: {
      show: true,
      content: '{author}',
      fontSize: '10pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '10pt'
    }
  },
  {
    id: 'a5-standard',
    name: 'A5 Standard',
    description: 'Format A5 universel (148 × 210mm)',
    region: 'uk',
    page: {
      width: '148mm',
      height: '210mm',
      marginTop: '18mm',
      marginBottom: '18mm',
      marginLeft: '15mm',
      marginRight: '15mm'
    },
    typography: {
      fontFamily: 'Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.4,
      paragraphSpacing: '0',
      firstLineIndent: '10mm'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },

  // ===================
  // FRENCH FORMATS
  // ===================
  {
    id: 'fr-poche',
    name: 'Poche Français',
    description: 'Format poche standard (11 × 18cm)',
    region: 'fr',
    page: {
      width: '11cm',
      height: '18cm',
      marginTop: '1.2cm',
      marginBottom: '1.2cm',
      marginLeft: '1cm',
      marginRight: '1cm'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '10pt',
      lineHeight: 1.3,
      paragraphSpacing: '0',
      firstLineIndent: '0.8cm'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '8pt'
    }
  },
  {
    id: 'fr-poche-large',
    name: 'Poche Français Large',
    description: 'Format poche élargi (12 × 19cm)',
    region: 'fr',
    page: {
      width: '12cm',
      height: '19cm',
      marginTop: '1.3cm',
      marginBottom: '1.3cm',
      marginLeft: '1.1cm',
      marginRight: '1.1cm'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '10.5pt',
      lineHeight: 1.35,
      paragraphSpacing: '0',
      firstLineIndent: '0.9cm'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
  {
    id: 'fr-broche',
    name: 'Broché Français',
    description: 'Format broché standard (14 × 21cm)',
    region: 'fr',
    page: {
      width: '14cm',
      height: '21cm',
      marginTop: '1.8cm',
      marginBottom: '1.8cm',
      marginLeft: '1.5cm',
      marginRight: '1.5cm'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.4,
      paragraphSpacing: '0',
      firstLineIndent: '1cm'
    },
    header: {
      show: true,
      content: '{title}',
      fontSize: '9pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
  {
    id: 'fr-grand-format',
    name: 'Grand Format Français',
    description: 'Grand format édition (15 × 23cm)',
    region: 'fr',
    page: {
      width: '15cm',
      height: '23cm',
      marginTop: '2cm',
      marginBottom: '2cm',
      marginLeft: '1.8cm',
      marginRight: '1.8cm'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '11.5pt',
      lineHeight: 1.45,
      paragraphSpacing: '0',
      firstLineIndent: '1.2cm'
    },
    header: {
      show: true,
      content: '{author}',
      fontSize: '10pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '10pt'
    }
  },
  {
    id: 'fr-grand-format-large',
    name: 'Grand Format Élargi',
    description: 'Format Gallimard/Bragelonne (15.5 × 24cm)',
    region: 'fr',
    page: {
      width: '15.5cm',
      height: '24cm',
      marginTop: '2.2cm',
      marginBottom: '2.2cm',
      marginLeft: '2cm',
      marginRight: '2cm'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '12pt',
      lineHeight: 1.5,
      paragraphSpacing: '0',
      firstLineIndent: '1.2cm'
    },
    header: {
      show: true,
      content: '{author}',
      fontSize: '10pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '10pt'
    }
  },

  // ===================
  // DIGITAL FORMATS
  // ===================
  {
    id: 'epub-standard',
    name: 'ePub / eBook',
    description: 'Format numérique reflowable',
    region: 'digital',
    page: {
      width: '100%',
      height: 'auto',
      marginTop: '1em',
      marginBottom: '1em',
      marginLeft: '1em',
      marginRight: '1em'
    },
    typography: {
      fontFamily: 'Georgia, serif',
      fontSize: '1em',
      lineHeight: 1.6,
      paragraphSpacing: '0.5em',
      firstLineIndent: '1.5em'
    }
  },
  {
    id: 'kindle-ready',
    name: 'Kindle Ready',
    description: 'Optimisé pour Amazon Kindle',
    region: 'digital',
    page: {
      width: '100%',
      height: 'auto',
      marginTop: '0',
      marginBottom: '0',
      marginLeft: '0',
      marginRight: '0'
    },
    typography: {
      fontFamily: 'Georgia, serif',
      fontSize: '1em',
      lineHeight: 1.5,
      paragraphSpacing: '0',
      firstLineIndent: '1.5em'
    }
  }
]
