// Single source of truth for pricing. Never hardcode a price in a component.
// Bulgarian convention: comma decimal, symbol after number.

export type Plan = {
  id: 'standard' | 'custom'
  name: string
  lev: string // primary price, e.g. "60 лв."
  euro: string // secondary price, e.g. "30,67 €"
  tagline: string
  features: string[]
  featured: boolean
  image: string
  imageAlt: string
}

export const plans: Plan[] = [
  {
    id: 'standard',
    name: 'Стандартен',
    lev: '58,67 лв.',
    euro: '30 €',
    tagline: 'Класическата къщичка, готова за игра.',
    features: [
      '100% рециклиран картон',
      'Сглобяване за 15 минути без инструменти',
      'Прибира се плоско за съхранение',
      'Видео ръководство за сглобяване',
      'Безопасни, заоблени ръбове',
    ],
    featured: false,
    image: '/images/model-standard.png',
    imageAlt: 'Стандартна картонена къщичка за игра',
  },
  {
    id: 'custom',
    name: 'Персонализиран',
    lev: '78,23 лв.',
    euro: '40 €',
    tagline: 'С името на детето, отпечатано върху къщичката.',
    features: [
      'Всичко от стандартния модел',
      'Име на детето, отпечатано на къщичката',
      'Допълнителна персонализация по избор',
      'Идеален подарък за рожден ден',
      'Видео ръководство за сглобяване',
    ],
    featured: true,
    image: '/images/model-custom.png',
    imageAlt: 'Персонализирана картонена къщичка с име на детето',
  },
]

// The lowest price, used in hero and metadata copy.
export const startingPrice = {
  lev: '58,67 лв.',
  euro: '30 €',
}
