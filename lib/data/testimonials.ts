export type Testimonial = {
  quote: string
  name: string
  location: string
}

// NOTE: These testimonials are FICTIONAL — placeholders for the prototype.
// Do not publish live. Replace with real customer reviews.
export const testimonials: Testimonial[] = [
  {
    quote:
      'Дъщеря ми играе в къщичката всеки ден. Сглобих я сама за петнайсет минути, докато тя гледаше с нетърпение.',
    name: 'Мария Г.', // fictional
    location: 'София',
  },
  {
    quote:
      'Взехме персонализирания модел с името на сина ни за третия му рожден ден. Реакцията му беше безценна.',
    name: 'Петър Д.', // fictional
    location: 'Пловдив',
  },
  {
    quote:
      'Хубаво е, че се прибира плоско. Когато не я използваме, я прибирам зад гардероба и не заема място.',
    name: 'Елена В.', // fictional
    location: 'Варна',
  },
]
