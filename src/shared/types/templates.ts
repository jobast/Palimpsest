export interface PageTemplate {
  id: string
  name: string
  description: string
  region: 'us' | 'fr' | 'uk' | 'digital'
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
  {
    id: 'us-trade',
    name: 'US Trade Paperback',
    description: 'Standard US trade format (6" x 9")',
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
      fontFamily: 'Times New Roman, Georgia, serif',
      fontSize: '12pt',
      lineHeight: 1.5,
      paragraphSpacing: '0',
      firstLineIndent: '0.5in'
    },
    header: {
      show: true,
      content: '{title}',
      fontSize: '10pt'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '10pt'
    }
  },
  {
    id: 'us-mass-market',
    name: 'US Mass Market',
    description: 'Mass market paperback (4.25" x 6.75")',
    region: 'us',
    page: {
      width: '4.25in',
      height: '6.75in',
      marginTop: '0.5in',
      marginBottom: '0.5in',
      marginLeft: '0.5in',
      marginRight: '0.5in'
    },
    typography: {
      fontFamily: 'Times New Roman, Georgia, serif',
      fontSize: '10pt',
      lineHeight: 1.4,
      paragraphSpacing: '0',
      firstLineIndent: '0.3in'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '8pt'
    }
  },
  {
    id: 'fr-poche',
    name: 'Format Poche Français',
    description: 'Format poche standard (11cm x 18cm)',
    region: 'fr',
    page: {
      width: '11cm',
      height: '18cm',
      marginTop: '1.5cm',
      marginBottom: '1.5cm',
      marginLeft: '1.2cm',
      marginRight: '1.2cm'
    },
    typography: {
      fontFamily: 'Garamond, Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.4,
      paragraphSpacing: '0',
      firstLineIndent: '1cm'
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
    description: 'Grand format édition (14cm x 22cm)',
    region: 'fr',
    page: {
      width: '14cm',
      height: '22cm',
      marginTop: '2cm',
      marginBottom: '2cm',
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
  {
    id: 'a5-standard',
    name: 'A5 Standard',
    description: 'Format A5 universel (148mm x 210mm)',
    region: 'uk',
    page: {
      width: '148mm',
      height: '210mm',
      marginTop: '20mm',
      marginBottom: '20mm',
      marginLeft: '20mm',
      marginRight: '20mm'
    },
    typography: {
      fontFamily: 'Georgia, serif',
      fontSize: '11pt',
      lineHeight: 1.5,
      paragraphSpacing: '0',
      firstLineIndent: '10mm'
    },
    footer: {
      show: true,
      showPageNumber: true,
      fontSize: '9pt'
    }
  },
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
