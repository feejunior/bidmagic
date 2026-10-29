import { Link } from 'react-router-dom'
import { ClockIcon, CrownIcon, ShieldIcon } from '../components/icons'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './HowItWorksPage.module.css'

export function HowItWorksPage() {
  usePageTitle('Como funciona')

  return (
    <article className={styles.page}>
      <header className={styles.intro}>
        <h1 className="page-title">Como funciona</h1>
        <p className="muted">
          O BidMagic é uma casa de leilões de cartas Magic: The Gathering. Leiloeiros publicam lotes, licitantes
          disputam com lances em tempo real e todo o histórico pode ser auditado por qualquer pessoa.
        </p>
      </header>

      <section className={styles.columns}>
        <div className={styles.card}>
          <h2>Para quem compra</h2>
          <ol>
            <li>
              <Link to="/cadastro">Crie uma conta</Link> de <strong>licitante</strong>.
            </li>
            <li>
              Deposite um saldo simulado na <strong>Carteira</strong>.
            </li>
            <li>Entre em um lote ao vivo e dê seu lance. A tela atualiza sozinha a cada novo lance.</li>
            <li>
              Venceu? O valor é debitado e você recebe um <strong>comprovante</strong> com link para compartilhar.
            </li>
          </ol>
        </div>
        <div className={styles.card}>
          <h2>Para quem vende</h2>
          <ol>
            <li>
              Crie uma conta de <strong>leiloeiro</strong>.
            </li>
            <li>Busque a carta no catálogo do Scryfall e defina lance inicial, incremento, início e duração.</li>
            <li>Acompanhe os lances em Meus lotes. Sem lances, o lote pode ser cancelado.</li>
            <li>Ao encerrar, o valor do lance vencedor é creditado para você.</li>
          </ol>
        </div>
      </section>

      <section className={styles.rules}>
        <h2>Regras do leilão</h2>
        <dl>
          <div>
            <dt>Lance mínimo</dt>
            <dd>
              O primeiro lance precisa ser pelo menos o lance inicial. Os seguintes precisam superar o lance atual em
              pelo menos o incremento mínimo do lote.
            </dd>
          </div>
          <div>
            <dt>Quem lidera não cobre o próprio lance</dt>
            <dd>Enquanto você estiver ganhando, o botão de lance fica bloqueado.</dd>
          </div>
          <div>
            <dt>Saldo comprometido</dt>
            <dd>
              Enquanto você lidera um lote, o valor do seu lance fica reservado. Se alguém cobrir, ele volta na hora
              para o seu saldo disponível. Só é possível dar lances e sacar com o saldo disponível.
            </dd>
          </div>
          <div>
            <dt>Papéis separados</dt>
            <dd>Leiloeiros não dão lances, e licitantes não criam lotes. O papel é escolhido no cadastro.</dd>
          </div>
        </dl>
      </section>

      <section className={styles.features}>
        <div className={styles.feature}>
          <ClockIcon size={22} />
          <h3>Prorrogação antissniping</h3>
          <p>
            Um lance aceito nos últimos 2 minutos estende o fim do lote para 2 minutos a partir daquele lance. Assim
            ninguém ganha com um lance no último segundo: todos sempre têm tempo para reagir.
          </p>
        </div>
        <div className={styles.feature}>
          <CrownIcon size={22} />
          <h3>Encerramento e comprovante</h3>
          <p>
            Quando o tempo acaba, o lote é liquidado em até 2 segundos: o vencedor é debitado, o leiloeiro é creditado
            e um comprovante com código único é emitido. Lotes sem lances fecham sem vencedor.
          </p>
        </div>
        <div className={styles.feature}>
          <ShieldIcon size={22} />
          <h3>Histórico à prova de adulteração</h3>
          <p>
            Cada lance carrega uma assinatura (HMAC-SHA256) que inclui a assinatura do lance anterior, formando uma
            corrente. Alterar, apagar ou inserir um lance, mesmo direto no banco de dados, quebra a corrente. A página
            de auditoria de cada lote mostra se o histórico está íntegro, e qualquer pessoa pode abri-la sem login.
          </p>
        </div>
      </section>

      <section className={styles.rules}>
        <h2>Privacidade</h2>
        <p className="muted">
          Na sala, na auditoria e no comprovante, cada pessoa aparece só por um codinome (por exemplo, Licitante
          #7F3A2B). Nome e e-mail nunca são exibidos.
        </p>
      </section>

      <p className={styles.note}>
        Os valores são simulados: depósitos e saques não movimentam dinheiro real. As imagens das cartas são meramente
        ilustrativas.
      </p>
    </article>
  )
}
