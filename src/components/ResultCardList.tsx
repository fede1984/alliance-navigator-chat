import { memo } from "react";
import type {
  AllianceProfileCard,
  KeyContactCard,
  WinStoryCard,
} from "../types/chat";

export type CardsByType = {
  alliances: AllianceProfileCard[];
  contacts: KeyContactCard[];
  stories: WinStoryCard[];
};

type ResultCardListProps = {
  groups: CardsByType;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number | null) {
  return value === null ? "Not available" : currencyFormatter.format(value);
}

export const ResultCardList = memo(function ResultCardList({
  groups,
}: ResultCardListProps) {
  const cards = [
    ...groups.alliances,
    ...groups.contacts,
    ...groups.stories,
  ];

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="cards" aria-label="Structured results">
      {cards.map((card) => {
        switch (card.kind) {
          case "alliance-profile":
            return (
              <article className="result-card" key={card.id}>
                <p className="card-kind">Alliance profile</p>
                <h3>{card.name}</h3>
                <dl>
                  <div>
                    <dt>Revenue</dt>
                    <dd>{formatCurrency(card.revenue)}</dd>
                  </div>
                  <div>
                    <dt>Pipeline</dt>
                    <dd>{formatCurrency(card.pipeline)}</dd>
                  </div>
                </dl>
              </article>
            );

          case "key-contact":
            return (
              <article className="result-card" key={card.id}>
                <p className="card-kind">Key contact</p>
                <h3>{card.name}</h3>
                <dl>
                  <div>
                    <dt>Role</dt>
                    <dd>{card.role ?? "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Organization</dt>
                    <dd>{card.organization}</dd>
                  </div>
                </dl>
              </article>
            );

          case "win-story":
            return (
              <article className="result-card" key={card.id}>
                <p className="card-kind">Win story</p>
                <h3>{card.title}</h3>
                <p>{card.summary ?? "Summary not available."}</p>
              </article>
            );
        }
      })}
    </section>
  );
});
