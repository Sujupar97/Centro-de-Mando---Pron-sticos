// Schema.org structured data generators for SEO pages

export interface SportsEventData {
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  matchDate: string; // YYYY-MM-DD
  matchTime?: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  hasResults: boolean;
  url: string;
}

/**
 * Generate Schema.org SportsEvent JSON-LD
 */
export function generateSportsEventSchema(data: SportsEventData): string {
  const event: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${data.homeTeam} vs ${data.awayTeam}`,
    description: `Pronóstico y análisis de ${data.homeTeam} vs ${data.awayTeam} en ${data.leagueName}`,
    startDate: data.matchTime
      ? `${data.matchDate}T${data.matchTime}`
      : data.matchDate,
    homeTeam: {
      "@type": "SportsTeam",
      name: data.homeTeam,
      ...(data.homeLogo ? { logo: data.homeLogo } : {}),
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: data.awayTeam,
      ...(data.awayLogo ? { logo: data.awayLogo } : {}),
    },
    sport: "Football",
    url: data.url,
    organizer: {
      "@type": "SportsOrganization",
      name: data.leagueName,
    },
  };

  if (data.hasResults && data.homeScore != null && data.awayScore != null) {
    event.eventStatus = "https://schema.org/EventScheduled";
    event.result = {
      "@type": "Thing",
      name: `${data.homeScore} - ${data.awayScore}`,
    };
  }

  return JSON.stringify(event);
}

/**
 * Generate Schema.org FAQPage JSON-LD for prediction pages
 */
export function generateFAQSchema(
  homeTeam: string,
  awayTeam: string,
  leagueName: string,
  analysisAvailable: boolean
): string {
  const faqs = [
    {
      "@type": "Question",
      name: `Quien gana ${homeTeam} vs ${awayTeam}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: analysisAvailable
          ? `Nuestro algoritmo de IA ha analizado mas de 5,000 variables para ${homeTeam} vs ${awayTeam} en ${leagueName}. Registrate gratis para ver la prediccion completa con probabilidades detalladas.`
          : `Estamos analizando este partido. Registrate para recibir el pronostico cuando este disponible.`,
      },
    },
    {
      "@type": "Question",
      name: `Cuantos goles habra en ${homeTeam} vs ${awayTeam}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `Nuestro modelo analiza goles promedio, tendencias de Over/Under y factores como lesiones y forma reciente. Crea una cuenta gratuita en Derbix para acceder al analisis detallado de goles.`,
      },
    },
    {
      "@type": "Question",
      name: `Donde ver las estadisticas de ${homeTeam} vs ${awayTeam}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `En esta pagina encontraras estadisticas clave como forma reciente, historial de enfrentamientos directos (H2H), goles promedio y factores relevantes para ${homeTeam} vs ${awayTeam}.`,
      },
    },
  ];

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs,
  });
}

/**
 * Generate BreadcrumbList Schema.org
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  });
}
