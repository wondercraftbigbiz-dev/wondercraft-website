import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/site/legal-page'
import { company } from '@/lib/data/company'

export const metadata: Metadata = {
  title: 'Политика за поверителност — Wondercraft',
  description:
    'Как Wondercraft събира, използва и защитава личните данни на клиентите си.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Политика за поверителност" updated="13 август 2026 г.">
      <LegalSection heading="1. Администратор на лични данни">
        <p>
          <strong>{company.legalName}</strong>, ЕИК {company.eik}, адрес{' '}
          {company.address}. За въпроси относно личните ви данни:{' '}
          {company.email}, тел. {company.phone}.
        </p>
      </LegalSection>

      <LegalSection heading="2. Какви данни събираме">
        <ul>
          <li>
            <strong>Данни за поръчка:</strong> име, имейл, телефон, град или офис
            на куриер, избран модел, количество, име за печат и бележки, които сами
            въвеждате.
          </li>
          <li>
            <strong>Данни за плащане:</strong> референция на транзакцията, сума,
            валута и статус, получени от доставчика на платежни услуги.{' '}
            <strong>Не получаваме и не съхраняваме данни от картата ви.</strong>
          </li>
          <li>
            <strong>Технически данни:</strong> тип браузър (user agent) към момента
            на поръчката, както и анонимна статистика за посещенията.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. За какво и на какво основание">
        <ul>
          <li>
            <strong>Изпълнение на договор</strong> — за да обработим и доставим
            поръчката ви и да издадем документ за покупка.
          </li>
          <li>
            <strong>Законово задължение</strong> — за счетоводна и данъчна
            отчетност.
          </li>
          <li>
            <strong>Съгласие</strong> — за да ви изпращаме новини и промоции, само
            ако изрично сте отбелязали това. Можете да го оттеглите по всяко време.
          </li>
          <li>
            <strong>Легитимен интерес</strong> — за защита срещу измами при
            плащане и за подобряване на сайта чрез анонимна статистика.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Кой има достъп">
        <p>Предоставяме данни само на доставчици, необходими за поръчката:</p>
        <ul>
          <li>
            <strong>myPOS Europe Ltd.</strong> — обработка на плащания с карта.
          </li>
          <li>
            <strong>{company.courier}</strong> — доставка на пратката.
          </li>
          <li>
            <strong>Supabase</strong> — хостинг на базата данни с поръчките
            (сървъри в Европейския съюз).
          </li>
          <li>
            <strong>Vercel</strong> — хостинг на сайта и анонимна статистика.
          </li>
        </ul>
        <p>Не продаваме и не отдаваме под наем лични данни на трети страни.</p>
      </LegalSection>

      <LegalSection heading="5. Колко дълго ги пазим">
        <p>
          Данните по поръчки пазим за срока, изискван от счетоводното и данъчното
          законодателство. Данните за маркетингови съобщения пазим до оттегляне на
          съгласието ви.
        </p>
      </LegalSection>

      <LegalSection heading="6. Вашите права">
        <p>
          Имате право на достъп, коригиране, изтриване, ограничаване на
          обработката, преносимост на данните и възражение, както и право да
          оттеглите съгласие за маркетинг. За да упражните право, пишете на{' '}
          {company.email}.
        </p>
        <p>
          Ако смятате, че правата ви са нарушени, можете да подадете жалба до{' '}
          {company.authorities.cpdp}.
        </p>
      </LegalSection>

      <LegalSection heading="7. Бисквитки">
        <p>
          Сайтът не използва рекламни или проследяващи бисквитки. Използваме само
          анонимна статистика за посещенията (Vercel Analytics), която не създава
          профил за отделен посетител.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
