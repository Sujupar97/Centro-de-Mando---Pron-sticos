import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- CONFIGURACIÓN DE ESTILO PREMIUM ---
const COLORS = {
    primary: '#0F172A',   // Slate 900 (Deep Blue/Black) - Fondo principal
    secondary: '#1E293B', // Slate 800 - Fondos secundarios
    accent: '#10B981',    // Emerald 500 - Acentos de éxito/marca
    text: '#334155',      // Slate 700 - Texto principal (en fondo blanco)
    lightText: '#64748B', // Slate 500 - Texto secundario
    white: '#FFFFFF',
    border: '#E2E8F0',    // Slate 200
    success: '#15803d',   // Green 700
    warning: '#b45309',   // Amber 700
    danger: '#b91c1c',    // Red 700
    brandBlue: '#3B82F6', // Blue 500
    purple: '#8B5CF6',    // Violet 500
    amber: '#F59E0B',     // Amber 500
};

const LOGO_URL = '/derbix-logo.png';
const CTA_URL = 'https://derbix.co';
const OPPORTUNITY_THRESHOLD = 83;
const PAGE_HEIGHT = 297; // A4 height
const PAGE_WIDTH = 210;  // A4 width
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_ZONE = 25; // space reserved for footer

// --- TIPOS ---
interface ReportOptions {
    fileName?: string;
    titleOverride?: string;
    isPromo?: boolean;
    onlyOpportunities?: boolean;
}

// --- UTILIDADES ---
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
            const empty = new Image();
            empty.width = 1;
            empty.height = 1;
            resolve(empty);
        };
    });
};

const formatDate = (dateStr: string | Date) => {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
};

const wrapText = (doc: jsPDF, text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(text, maxWidth);
};

/**
 * Verifica si hay espacio suficiente. Si no, crea nueva página con header y footer.
 * Retorna la posición Y donde se puede empezar a escribir.
 */
const ensureSpace = (doc: jsPDF, y: number, needed: number, pageTitle: string, logo: HTMLImageElement, isPromo: boolean): number => {
    if (y + needed > PAGE_HEIGHT - FOOTER_ZONE) {
        doc.addPage();
        const newY = addPageHeader(doc, pageTitle, logo);
        addFooter(doc, doc.getNumberOfPages(), isPromo);
        return newY;
    }
    return y;
};

// --- COMPONENTES DE DISEÑO ---

// 1. PORTADA
const addCoverPage = (doc: jsPDF, title: string, subtitle: string, logo: HTMLImageElement, date: string, isPromo: boolean) => {
    // Fondo Principal (Dark Theme)
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

    // Acentos Geométricos
    doc.setFillColor(COLORS.accent);
    doc.triangle(PAGE_WIDTH, 0, PAGE_WIDTH - 60, 0, PAGE_WIDTH, 60, 'F');
    doc.rect(0, PAGE_HEIGHT - 15, PAGE_WIDTH, 15, 'F');

    // Logo
    if (logo.width > 1) {
        const logoWidth = 60;
        const logoHeight = (logo.height / logo.width) * logoWidth;
        doc.addImage(logo, 'PNG', (PAGE_WIDTH - logoWidth) / 2, 40, logoWidth, logoHeight);
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(40);
        doc.setTextColor(COLORS.white);
        doc.text('DERBIX', PAGE_WIDTH / 2, 60, { align: 'center' });
    }

    // Título Principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(COLORS.white);
    const splitTitle = wrapText(doc, title, PAGE_WIDTH - 40);
    doc.text(splitTitle, PAGE_WIDTH / 2, 120, { align: 'center' });

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(COLORS.lightText);
    const splitSub = wrapText(doc, subtitle, PAGE_WIDTH - 50);
    doc.text(splitSub, PAGE_WIDTH / 2, 120 + splitTitle.length * 12 + 10, { align: 'center' });

    // Línea Divisoria
    doc.setDrawColor(COLORS.accent);
    doc.setLineWidth(1);
    const lineY = 120 + splitTitle.length * 12 + splitSub.length * 7 + 20;
    doc.line(PAGE_WIDTH / 2 - 30, lineY, PAGE_WIDTH / 2 + 30, lineY);

    // Fecha / ID
    doc.setFontSize(11);
    doc.setTextColor(COLORS.white);
    doc.text(`Fecha de Emisión: ${date}`, PAGE_WIDTH / 2, lineY + 15, { align: 'center' });
    doc.text(`ID de Informe: DBX-${Math.floor(Math.random() * 10000)}`, PAGE_WIDTH / 2, lineY + 25, { align: 'center' });

    // Footer de Portada
    doc.setFontSize(10);
    doc.setTextColor(COLORS.lightText);
    doc.text('INTELIGENCIA ARTIFICIAL APLICADA AL DEPORTE', PAGE_WIDTH / 2, PAGE_HEIGHT - 25, { align: 'center' });

    // CTA en portada si promo
    if (isPromo) {
        addCtaButton(doc, 'derbix.co — Inteligencia Deportiva con IA', CTA_URL, 30, PAGE_HEIGHT - 45, 150, 12);
    }
};

// 2. HEADER PARA PÁGINAS INTERNAS
const addPageHeader = (doc: jsPDF, title: string, logo: HTMLImageElement): number => {
    if (logo.width > 1) {
        const logoW = 25;
        const logoH = (logo.height / logo.width) * logoW;
        doc.addImage(logo, 'PNG', MARGIN, 10, logoW, logoH);
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(COLORS.primary);
        doc.text('DERBIX', MARGIN, 20);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(COLORS.primary);
    doc.text(title, PAGE_WIDTH - MARGIN, 18, { align: 'right' });

    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, 25, PAGE_WIDTH - MARGIN, 25);

    return 35;
};

// 3. FOOTER
const addFooter = (doc: jsPDF, pageNumber: number, isPromo: boolean = false) => {
    doc.setDrawColor(COLORS.border);
    doc.line(MARGIN, PAGE_HEIGHT - 15, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 15);

    doc.setFontSize(8);
    doc.setTextColor(COLORS.lightText);

    if (isPromo) {
        doc.setTextColor(COLORS.accent);
        doc.text('derbix.co — Inteligencia Deportiva con IA', MARGIN, PAGE_HEIGHT - 10);
        doc.link(MARGIN, PAGE_HEIGHT - 14, 100, 8, { url: CTA_URL });
    } else {
        doc.text(`Confidencial — Propiedad de Derbix AI © ${new Date().getFullYear()}`, MARGIN, PAGE_HEIGHT - 10);
    }

    doc.setTextColor(COLORS.lightText);
    doc.text(`Página ${pageNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
};

// 4. CTA BUTTON (clickable link)
const addCtaButton = (doc: jsPDF, text: string, url: string, x: number, y: number, width: number, height: number) => {
    doc.setFillColor(COLORS.accent);
    doc.roundedRect(x, y, width, height, 3, 3, 'F');

    doc.setTextColor(COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(text, x + width / 2, y + height / 2 + 3.5, { align: 'center' });

    doc.link(x, y, width, height, { url });
};

// 5. SECCIÓN TÍTULO
const addSectionTitle = (doc: jsPDF, title: string, y: number, color: string = COLORS.primary): number => {
    doc.setFontSize(14);
    doc.setTextColor(color);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), MARGIN, y);
    return y + 8;
};

// 6. PÁRRAFO
const addParagraph = (doc: jsPDF, text: string, y: number, fontSize: number = 10, maxWidth: number = CONTENT_WIDTH): number => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text);
    const lines = wrapText(doc, text, maxWidth);
    doc.text(lines, MARGIN, y);
    return y + lines.length * (fontSize * 0.5) + 4;
};

// 7. METRIC BOX (inline)
const drawMetricBox = (doc: jsPDF, label: string, value: string, x: number, y: number, width: number, color: string) => {
    doc.setFillColor(color);
    doc.roundedRect(x, y, width, 25, 3, 3, 'F');
    doc.setTextColor(COLORS.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + width / 2, y + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + width / 2, y + 19, { align: 'center' });
};

// ═══════════════════════════════════════════════════════
//   PAGE SECTIONS — 8 páginas
// ═══════════════════════════════════════════════════════

// PÁGINA 2: Resumen Ejecutivo
const addExecutiveSummaryPage = (doc: jsPDF, data: any, logo: HTMLImageElement, isPromo: boolean): void => {
    doc.addPage();
    let y = addPageHeader(doc, 'Resumen Ejecutivo', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    // Frase Principal
    if (data.resumen_ejecutivo?.frase_principal || data.resumen_ejecutivo?.titular) {
        doc.setFontSize(16);
        doc.setTextColor(COLORS.primary);
        doc.setFont('helvetica', 'bold');
        const titulo = data.resumen_ejecutivo?.frase_principal || data.resumen_ejecutivo?.titular;
        const splitT = wrapText(doc, `"${titulo}"`, CONTENT_WIDTH);
        doc.text(splitT, MARGIN, y + 5);
        y += splitT.length * 8 + 12;
    }

    // Puntos Clave
    if (data.resumen_ejecutivo?.puntos_clave?.length) {
        y = addSectionTitle(doc, 'Puntos Clave', y);
        doc.setFontSize(10);
        doc.setTextColor(COLORS.text);
        doc.setFont('helvetica', 'normal');
        data.resumen_ejecutivo.puntos_clave.forEach((point: string) => {
            y = ensureSpace(doc, y, 12, 'Resumen Ejecutivo', logo, isPromo);
            const splitP = wrapText(doc, `• ${point}`, CONTENT_WIDTH - 5);
            doc.text(splitP, MARGIN + 5, y);
            y += splitP.length * 5 + 3;
        });
        y += 8;
    }

    // Veredicto del Analista (si existe)
    if (data.veredicto_analista) {
        y = ensureSpace(doc, y, 40, 'Resumen Ejecutivo', logo, isPromo);
        const va = data.veredicto_analista;

        // Caja de veredicto
        doc.setFillColor(va.decision === 'APOSTAR' ? COLORS.accent : va.decision === 'EVITAR' ? COLORS.danger : COLORS.warning);
        doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 3, 3, 'F');
        doc.setTextColor(COLORS.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const decisionLabel = va.decision === 'APOSTAR' ? 'OPORTUNIDAD CLARA' : va.decision === 'EVITAR' ? 'NO APOSTAR' : 'OBSERVAR';
        doc.text(decisionLabel, PAGE_WIDTH / 2, y + 12, { align: 'center' });

        if (va.seleccion_clave) {
            doc.setFontSize(10);
            doc.text(va.seleccion_clave, PAGE_WIDTH / 2, y + 22, { align: 'center' });
        }
        y += 38;

        if (va.razon_principal) {
            doc.setFontSize(10);
            doc.setTextColor(COLORS.text);
            doc.setFont('helvetica', 'italic');
            const splitR = wrapText(doc, `"${va.razon_principal}"`, CONTENT_WIDTH);
            doc.text(splitR, MARGIN, y);
            y += splitR.length * 5 + 8;
        }
    }

    // Oportunidades top (tabla resumen)
    if (data.analisis_mercados_calculados?.top_oportunidades) {
        y = ensureSpace(doc, y, 50, 'Resumen Ejecutivo', logo, isPromo);
        y = addSectionTitle(doc, 'Oportunidades de Valor Detectadas', y);

        const oportunidades = data.analisis_mercados_calculados.top_oportunidades.slice(0, 5);
        const tableBody = oportunidades.map((p: any) => [
            p.mercado,
            `${p.probabilidad_calculada}%`,
            `+${p.value_score}%`,
            p.confianza
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Mercado', 'Probabilidad', 'Valor', 'Confianza']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: COLORS.accent },
            styles: { fontSize: 9, cellPadding: 3 }
        });
    }
};

// PÁGINA 3: Dual Scores + Patrones V8
const addDualScoresPage = (doc: jsPDF, data: any, logo: HTMLImageElement, isPromo: boolean): void => {
    doc.addPage();
    let y = addPageHeader(doc, 'Scores del Modelo', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    const scores = data.scores_duales;
    if (scores) {
        y = addSectionTitle(doc, 'Sistema de Doble Score', y);

        // Descripción introductoria
        doc.setFontSize(9);
        doc.setTextColor(COLORS.lightText);
        doc.setFont('helvetica', 'normal');
        doc.text('El modelo analiza cada partido desde dos perspectivas independientes para generar una confianza calibrada.', MARGIN, y);
        y += 10;

        const boxWidth = (CONTENT_WIDTH - 10) / 3;

        // Score Estadístico
        const statsScore = scores.score_estadistico || scores.stats_score || 0;
        drawMetricBox(doc, 'Score Estadístico', `${statsScore}%`, MARGIN, y, boxWidth, COLORS.brandBlue);

        // Score de Contexto
        const ctxScore = scores.score_contextual || scores.context_score || 0;
        drawMetricBox(doc, 'Score de Contexto', `${ctxScore}%`, MARGIN + boxWidth + 5, y, boxWidth, COLORS.purple);

        // Confianza Final
        const finalScore = scores.confianza_final || scores.final_confidence || 0;
        drawMetricBox(doc, 'Confianza Final', `${finalScore}%`, MARGIN + (boxWidth + 5) * 2, y, boxWidth, COLORS.accent);

        y += 33;

        // Descripciones
        const descriptions = [
            { label: 'Score Estadístico', desc: 'Confianza basada en datos estadísticos puros: forma reciente, xG, goles, corners.' },
            { label: 'Score de Contexto', desc: 'Confianza basada en contexto del partido: presión competitiva, psicología, noticias.' },
            { label: 'Confianza Final', desc: 'Combinación ponderada 50/50 de ambos scores.' },
        ];
        descriptions.forEach(d => {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.primary);
            doc.text(d.label, MARGIN, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.lightText);
            doc.text(` — ${d.desc}`, MARGIN + doc.getTextWidth(d.label), y);
            y += 6;
        });

        if (scores.justificacion_balance) {
            y += 4;
            doc.setFontSize(9);
            doc.setTextColor(COLORS.text);
            doc.setFont('helvetica', 'italic');
            const splitJ = wrapText(doc, scores.justificacion_balance, CONTENT_WIDTH);
            doc.text(splitJ, MARGIN, y);
            y += splitJ.length * 4.5 + 6;
        }
        y += 8;
    }

    // Patrones V8
    const patrones = data.patrones_detectados;
    if (patrones) {
        y = ensureSpace(doc, y, 60, 'Scores del Modelo', logo, isPromo);
        y = addSectionTitle(doc, 'Patrones Detectados', y, COLORS.warning);

        // Goles por Tiempo
        if (patrones.goles_por_tiempo) {
            y = ensureSpace(doc, y, 40, 'Scores del Modelo', logo, isPromo);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.secondary);
            doc.text('Goles por Tiempo', MARGIN, y);
            y += 6;

            const gtData = patrones.goles_por_tiempo;
            const rows = [
                ['Local 1T', `${gtData.home_1er_tiempo_pct || '-'}%`],
                ['Local 2T', `${gtData.home_2do_tiempo_pct || '-'}%`],
                ['Visitante 1T', `${gtData.away_1er_tiempo_pct || '-'}%`],
                ['Visitante 2T', `${gtData.away_2do_tiempo_pct || '-'}%`],
            ];
            autoTable(doc, {
                startY: y,
                body: rows,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 0: { fontStyle: 'normal', textColor: COLORS.text }, 1: { fontStyle: 'bold', halign: 'right' } },
            });
            // @ts-ignore
            y = doc.lastAutoTable.finalY + 4;

            if (gtData.insight) {
                doc.setFontSize(8);
                doc.setTextColor(COLORS.warning);
                doc.setFont('helvetica', 'italic');
                const splitI = wrapText(doc, gtData.insight, CONTENT_WIDTH);
                doc.text(splitI, MARGIN, y);
                y += splitI.length * 4 + 6;
            }
        }

        // Formación / Rendimiento
        if (patrones.formacion_rendimiento) {
            y = ensureSpace(doc, y, 30, 'Scores del Modelo', logo, isPromo);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.secondary);
            doc.text('Formaciones y Rendimiento', MARGIN, y);
            y += 6;

            const fr = patrones.formacion_rendimiento;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.text);
            doc.text(`Local: ${fr.home_formacion_usual || '-'} (${fr.home_win_pct_con_formacion || '-'}% win)`, MARGIN, y);
            y += 5;
            doc.text(`Visitante: ${fr.away_formacion_usual || '-'} (${fr.away_win_pct_con_formacion || '-'}% win)`, MARGIN, y);
            y += 5;

            if (fr.insight) {
                doc.setFontSize(8);
                doc.setTextColor(COLORS.brandBlue);
                doc.setFont('helvetica', 'italic');
                const splitI = wrapText(doc, fr.insight, CONTENT_WIDTH);
                doc.text(splitI, MARGIN, y);
                y += splitI.length * 4 + 6;
            }
        }

        // Disciplina
        if (patrones.disciplina) {
            y = ensureSpace(doc, y, 25, 'Scores del Modelo', logo, isPromo);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.secondary);
            doc.text('Disciplina', MARGIN, y);
            y += 6;

            const disc = patrones.disciplina;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.text);
            doc.text(`Prom. Tarjetas Local: ${disc.home_avg_tarjetas || '-'}`, MARGIN, y);
            y += 5;
            doc.text(`Prom. Tarjetas Visitante: ${disc.away_avg_tarjetas || '-'}`, MARGIN, y);
            y += 5;

            if (disc.insight) {
                doc.setFontSize(8);
                doc.setTextColor(COLORS.danger);
                doc.setFont('helvetica', 'italic');
                const splitI = wrapText(doc, disc.insight, CONTENT_WIDTH);
                doc.text(splitI, MARGIN, y);
                y += splitI.length * 4 + 6;
            }
        }
    }
};

// PÁGINA 4: Análisis Táctico
const addTacticalPage = (doc: jsPDF, data: any, logo: HTMLImageElement, isPromo: boolean): void => {
    doc.addPage();
    let y = addPageHeader(doc, 'Análisis Táctico', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    // Intro
    doc.setFontSize(9);
    doc.setTextColor(COLORS.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text('Factores tácticos, psicológicos y contextuales que influyen en el resultado.', MARGIN, y);
    y += 10;

    // Contexto Competitivo
    if (data.contexto_competitivo) {
        y = addSectionTitle(doc, 'Contexto Competitivo', y);
        const ctx = data.contexto_competitivo;

        if (ctx.situacion_local) {
            y = ensureSpace(doc, y, 15, 'Análisis Táctico', logo, isPromo);
            y = addParagraph(doc, `Local: ${ctx.situacion_local}`, y);
        }
        if (ctx.situacion_visitante) {
            y = ensureSpace(doc, y, 15, 'Análisis Táctico', logo, isPromo);
            y = addParagraph(doc, `Visitante: ${ctx.situacion_visitante}`, y);
        }
        y += 5;
    }

    // Análisis Táctico (matchup)
    if (data.analisis_tactico || data.analisis_detallado?.matchup_tactico || data.analisis_detallado?.estilo_y_tactica) {
        y = ensureSpace(doc, y, 20, 'Análisis Táctico', logo, isPromo);
        y = addSectionTitle(doc, 'Matchup Táctico', y);

        const tactico = data.analisis_tactico?.matchup ||
            (typeof data.analisis_tactico === 'string' ? data.analisis_tactico : '') ||
            data.analisis_detallado?.matchup_tactico?.contenido ||
            data.analisis_detallado?.estilo_y_tactica?.contenido || '';

        if (tactico) {
            y = addParagraph(doc, tactico, y);
            y += 5;
        }
    }

    // Razonamiento Central
    if (data.analisis_detallado?.razonamiento_central) {
        y = ensureSpace(doc, y, 20, 'Análisis Táctico', logo, isPromo);
        y = addSectionTitle(doc, 'Razonamiento Central', y);
        y = addParagraph(doc, data.analisis_detallado.razonamiento_central, y);
        y += 5;
    }

    // Factor Psicológico
    if (data.analisis_detallado?.factor_psicologico) {
        y = ensureSpace(doc, y, 20, 'Análisis Táctico', logo, isPromo);
        y = addSectionTitle(doc, 'Factor Psicológico', y, COLORS.purple);

        const fp = data.analisis_detallado.factor_psicologico;
        const content = typeof fp === 'string' ? fp : fp.contenido || fp.analisis || '';
        if (content) {
            y = addParagraph(doc, content, y);
        }
        y += 5;
    }

    // Impacto Árbitro
    if (data.analisis_detallado?.impacto_arbitro) {
        y = ensureSpace(doc, y, 20, 'Análisis Táctico', logo, isPromo);
        y = addSectionTitle(doc, 'Impacto del Árbitro', y, COLORS.warning);

        const ia = data.analisis_detallado.impacto_arbitro;
        const content = typeof ia === 'string' ? ia : ia.contenido || ia.analisis || '';
        if (content) {
            y = addParagraph(doc, content, y);
        }
        y += 5;
    }

    // Contexto externo (noticias)
    if (data.contexto_externo_resumen) {
        y = ensureSpace(doc, y, 20, 'Análisis Táctico', logo, isPromo);
        y = addSectionTitle(doc, 'Contexto Externo (Noticias)', y, COLORS.brandBlue);
        y = addParagraph(doc, data.contexto_externo_resumen, y);
    }
};

// PÁGINA 5: Escenarios de Partido
const addScenariosPage = (doc: jsPDF, data: any, logo: HTMLImageElement, isPromo: boolean): void => {
    const escenarios = data.analisis_detallado?.analisis_escenarios?.escenarios ||
        data.analisis_detallado?.escenarios_de_partido?.escenarios || [];

    if (escenarios.length === 0) return;

    doc.addPage();
    let y = addPageHeader(doc, 'Escenarios de Partido', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    y = addSectionTitle(doc, 'Escenarios Proyectados', y);

    doc.setFontSize(9);
    doc.setTextColor(COLORS.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text('Escenarios más probables según el modelo, con su implicación para apuestas.', MARGIN, y);
    y += 10;

    escenarios.forEach((esc: any) => {
        y = ensureSpace(doc, y, 45, 'Escenarios de Partido', logo, isPromo);

        // Header del escenario
        doc.setFillColor(COLORS.secondary);
        doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 2, 2, 'F');
        doc.setTextColor(COLORS.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(esc.nombre || 'Escenario', MARGIN + 4, y + 8);

        if (esc.probabilidad_aproximada) {
            doc.setFontSize(9);
            doc.text(esc.probabilidad_aproximada, PAGE_WIDTH - MARGIN - 4, y + 8, { align: 'right' });
        }
        y += 16;

        // Descripción
        if (esc.descripcion) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.text);
            const splitD = wrapText(doc, esc.descripcion, CONTENT_WIDTH - 4);
            doc.text(splitD, MARGIN + 2, y);
            y += splitD.length * 4.5 + 4;
        }

        // Implicación apuestas
        if (esc.implicacion_apuestas) {
            doc.setFillColor('#EFF6FF'); // blue-50
            doc.roundedRect(MARGIN + 2, y, CONTENT_WIDTH - 4, 10, 2, 2, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.brandBlue);
            doc.text(`Apuesta: ${esc.implicacion_apuestas}`, MARGIN + 6, y + 7);
            y += 14;
        }

        y += 4;
    });
};

// PÁGINA 6: Predicciones
const addPredictionsPage = (doc: jsPDF, data: any, logo: HTMLImageElement, options: ReportOptions): void => {
    const predicciones = data.predicciones_finales?.detalle || [];
    if (predicciones.length === 0) return;

    const isPromo = options.isPromo || false;

    let preds = predicciones;
    if (options.onlyOpportunities) {
        preds = predicciones.filter((p: any) =>
            (p.probabilidad_estimado_porcentaje || p.probabilidad_estimada || 0) >= OPPORTUNITY_THRESHOLD
        );
    }

    if (preds.length === 0) return;

    doc.addPage();
    let y = addPageHeader(doc, 'Predicciones del Modelo', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    y = addSectionTitle(doc, 'Predicciones del Modelo', y);

    if (options.onlyOpportunities) {
        doc.setFontSize(9);
        doc.setTextColor(COLORS.accent);
        doc.setFont('helvetica', 'bold');
        doc.text(`Solo Oportunidades de Valor (≥ ${OPPORTUNITY_THRESHOLD}%)`, MARGIN, y);
        y += 8;
    }

    doc.setFontSize(9);
    doc.setTextColor(COLORS.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text('Pronósticos generados por IA. Las oportunidades ≥ 83% tienen valor confirmado.', MARGIN, y);
    y += 10;

    preds.forEach((pred: any, index: number) => {
        y = ensureSpace(doc, y, 50, 'Predicciones del Modelo', logo, isPromo);

        const prob = pred.probabilidad_estimado_porcentaje || pred.probabilidad_estimada || 0;
        const isOpportunity = prob >= OPPORTUNITY_THRESHOLD;
        const mercado = pred.mercado || pred.market || '-';
        const seleccion = pred.seleccion || pred.prediction || pred.pick || '-';
        const odds = pred.cuota_mercado || pred.odds || '-';
        const edge = pred.edge_porcentaje || pred.value || '-';
        const justificacion = pred.justificacion || pred.argument || pred.razonamiento || '';

        // Card background
        const cardColor = isOpportunity ? '#064E3B' : COLORS.secondary; // emerald-900 or slate-800
        doc.setFillColor(cardColor);
        doc.roundedRect(MARGIN, y, CONTENT_WIDTH, isPromo ? 22 : 18, 2, 2, 'F');

        // Mercado + número
        doc.setTextColor(COLORS.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`#${index + 1}  ${mercado}`, MARGIN + 4, y + 8);

        // Odds (siempre visible)
        doc.setFontSize(9);
        doc.text(`@${odds}`, PAGE_WIDTH - MARGIN - 4, y + 8, { align: 'right' });

        if (isPromo) {
            // En promo: NO mostrar selección ni probabilidad
            doc.setFontSize(8);
            doc.setTextColor(COLORS.accent);
            doc.text('Ver pronóstico completo en derbix.co', MARGIN + 4, y + 16);
            doc.link(MARGIN, y + 10, CONTENT_WIDTH, 10, { url: CTA_URL });
            y += 26;
        } else {
            // Completo: selección + probabilidad + edge
            doc.setFontSize(9);
            doc.setTextColor(isOpportunity ? COLORS.accent : '#CBD5E1'); // emerald or slate-300
            doc.text(`${seleccion}  |  ${prob}%  |  Ventaja: ${edge}%`, MARGIN + 4, y + 14);
            y += 22;

            // Justificación
            if (justificacion) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(COLORS.lightText);
                const splitJ = wrapText(doc, justificacion, CONTENT_WIDTH - 8);
                doc.text(splitJ, MARGIN + 4, y);
                y += splitJ.length * 4 + 4;
            }
        }

        // Badge de oportunidad
        if (isOpportunity && !isPromo) {
            doc.setFillColor(COLORS.accent);
            doc.roundedRect(PAGE_WIDTH - MARGIN - 45, y - (justificacion ? (wrapText(doc, justificacion, CONTENT_WIDTH - 8).length * 4 + 4) : 0) - 22 + 11, 41, 6, 2, 2, 'F');
            doc.setFontSize(6);
            doc.setTextColor(COLORS.white);
            doc.setFont('helvetica', 'bold');
            doc.text('OPORTUNIDAD', PAGE_WIDTH - MARGIN - 24.5, y - (justificacion ? (wrapText(doc, justificacion, CONTENT_WIDTH - 8).length * 4 + 4) : 0) - 22 + 15.5, { align: 'center' });
        }

        y += 4;
    });

    // CTA en promo al final
    if (isPromo) {
        y = ensureSpace(doc, y, 25, 'Predicciones del Modelo', logo, isPromo);
        y += 8;
        addCtaButton(doc, 'Ver todos los pronósticos en derbix.co', CTA_URL, MARGIN + 20, y, CONTENT_WIDTH - 40, 14);
    }
};

// PÁGINA 7: 60+ Mercados
const addMarketsPage = (doc: jsPDF, data: any, logo: HTMLImageElement, isPromo: boolean): void => {
    if (isPromo) return; // Omitido en modo promo

    const mercados = data.analisis_mercados_calculados;
    if (!mercados) return;

    doc.addPage();
    let y = addPageHeader(doc, 'Análisis de 60+ Mercados', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    y = addSectionTitle(doc, 'Ranking de Mercados por Valor', y, COLORS.purple);

    doc.setFontSize(9);
    doc.setTextColor(COLORS.lightText);
    doc.setFont('helvetica', 'normal');
    doc.text('Mercados donde el modelo detecta mayor discrepancia entre probabilidad real y cuotas.', MARGIN, y);
    y += 10;

    // Top oportunidades
    if (mercados.top_oportunidades?.length) {
        const tableBody = mercados.top_oportunidades.slice(0, 10).map((op: any, i: number) => [
            `${i + 1}`,
            op.mercado || '-',
            `${op.probabilidad_calculada || '-'}%`,
            op.cuota ? `@${op.cuota}` : '-',
            `+${op.value_score || '-'}%`,
            op.confianza || '-',
        ]);

        autoTable(doc, {
            startY: y,
            head: [['#', 'Mercado', 'Prob.', 'Cuota', 'Valor', 'Confianza']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: COLORS.purple, fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 55 },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 20, halign: 'center', textColor: COLORS.accent },
                5: { cellWidth: 25, halign: 'center' },
            }
        });
        // @ts-ignore
        y = doc.lastAutoTable.finalY + 10;
    }

    // Resumen de mercados
    if (mercados.resumen) {
        y = ensureSpace(doc, y, 35, 'Análisis de 60+ Mercados', logo, isPromo);

        doc.setFillColor(COLORS.secondary);
        doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 3, 3, 'F');

        doc.setTextColor(COLORS.white);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('MÉTRICAS ESPERADAS', PAGE_WIDTH / 2, y + 8, { align: 'center' });

        doc.setFontSize(10);
        const stats = mercados.resumen;
        const xgText = `xG: ${stats.goles_esperados?.toFixed(2) || '-'}`;
        const xcText = `xCorners: ${stats.corners_esperados?.toFixed(2) || '-'}`;
        const xtText = `xTarjetas: ${stats.tarjetas_esperadas?.toFixed(2) || '-'}`;

        doc.text(xgText, 40, y + 20, { align: 'center' });
        doc.text(xcText, PAGE_WIDTH / 2, y + 20, { align: 'center' });
        doc.text(xtText, PAGE_WIDTH - 40, y + 20, { align: 'center' });
    }
};

// PÁGINA 8: Advertencias + Disclaimer
const addWarningsPage = (doc: jsPDF, data: any, logo: HTMLImageElement, isPromo: boolean): void => {
    doc.addPage();
    let y = addPageHeader(doc, 'Advertencias y Disclaimer', logo);
    addFooter(doc, doc.getNumberOfPages(), isPromo);

    // Advertencias del análisis
    if (data.advertencias?.bullets?.length) {
        y = addSectionTitle(doc, data.advertencias.titulo || 'Advertencias', y, COLORS.warning);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.text);
        data.advertencias.bullets.forEach((w: string) => {
            y = ensureSpace(doc, y, 12, 'Advertencias y Disclaimer', logo, isPromo);
            const splitW = wrapText(doc, `⚠ ${w}`, CONTENT_WIDTH - 5);
            doc.text(splitW, MARGIN + 2, y);
            y += splitW.length * 5 + 3;
        });
        y += 10;
    }

    // Disclaimer Legal
    y = ensureSpace(doc, y, 80, 'Advertencias y Disclaimer', logo, isPromo);
    y = addSectionTitle(doc, 'Disclaimer Legal', y, COLORS.danger);

    doc.setFillColor('#FEF2F2'); // red-50
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 70, 3, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.danger);

    const disclaimer = [
        'Este informe es generado por inteligencia artificial con fines informativos y educativos.',
        'No constituye asesoría financiera, legal ni de inversión.',
        'Las apuestas deportivas conllevan riesgo de pérdida. Nunca apueste más de lo que pueda permitirse perder.',
        'Los resultados pasados no garantizan resultados futuros.',
        'Las probabilidades y predicciones son estimaciones del modelo y pueden diferir del resultado real.',
        'Derbix no se hace responsable por decisiones tomadas basándose en este informe.',
        'Si tiene problemas con el juego, busque ayuda profesional.',
    ];

    let dy = y + 8;
    disclaimer.forEach(line => {
        const splitL = wrapText(doc, `• ${line}`, CONTENT_WIDTH - 10);
        doc.text(splitL, MARGIN + 5, dy);
        dy += splitL.length * 4 + 3;
    });

    y = dy + 15;

    // Contacto
    y = ensureSpace(doc, y, 25, 'Advertencias y Disclaimer', logo, isPromo);
    doc.setFontSize(9);
    doc.setTextColor(COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('Generado por Derbix AI — Inteligencia Deportiva', PAGE_WIDTH / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.accent);
    doc.text('derbix.co', PAGE_WIDTH / 2, y, { align: 'center' });
    doc.link(PAGE_WIDTH / 2 - 15, y - 4, 30, 8, { url: CTA_URL });
};


// ═══════════════════════════════════════════════════════
//   GENERADORES PRINCIPALES
// ═══════════════════════════════════════════════════════

/**
 * Genera PDF para Análisis de Partido Individual — 8 páginas
 *
 * Estructura:
 * 1. Portada
 * 2. Resumen Ejecutivo
 * 3. Dual Scores + Patrones
 * 4. Análisis Táctico
 * 5. Escenarios de Partido
 * 6. Predicciones del Modelo
 * 7. 60+ Mercados (omitido en promo)
 * 8. Advertencias + Disclaimer
 */
export const generateMatchAnalysisPDF = async (analysisRun: any, options: ReportOptions = {}) => {
    try {
        const doc = new jsPDF();
        const logo = await loadImage(LOGO_URL);
        const data = analysisRun.report_pre_jsonb || {};
        const isPromo = options.isPromo || false;

        // Extraer título
        let fixtureTitle = data.header_partido?.titulo || 'Análisis de Partido';
        if (!data.header_partido) {
            const ctx = data.contexto_competitivo || {};
            fixtureTitle = `${ctx.situacion_local?.split(' vs ')[0] || 'Local'} vs ${ctx.situacion_visitante?.split(' vs ')[1] || 'Visitante'}`;
        }
        const fixtureSubtitle = data.header_partido?.subtitulo || '';
        const dateStr = formatDate(new Date());

        // --- PÁGINA 1: PORTADA ---
        addCoverPage(doc, "Informe de Análisis Táctico", fixtureTitle, logo, dateStr, isPromo);

        // --- PÁGINA 2: RESUMEN EJECUTIVO ---
        addExecutiveSummaryPage(doc, data, logo, isPromo);

        // --- PÁGINA 3: DUAL SCORES + PATRONES ---
        if (data.scores_duales || data.patrones_detectados) {
            addDualScoresPage(doc, data, logo, isPromo);
        }

        // --- PÁGINA 4: ANÁLISIS TÁCTICO ---
        if (data.contexto_competitivo || data.analisis_tactico || data.analisis_detallado) {
            addTacticalPage(doc, data, logo, isPromo);
        }

        // --- PÁGINA 5: ESCENARIOS ---
        addScenariosPage(doc, data, logo, isPromo);

        // --- PÁGINA 6: PREDICCIONES ---
        addPredictionsPage(doc, data, logo, options);

        // --- PÁGINA 7: 60+ MERCADOS ---
        addMarketsPage(doc, data, logo, isPromo);

        // --- PÁGINA 8: ADVERTENCIAS + DISCLAIMER ---
        addWarningsPage(doc, data, logo, isPromo);

        doc.save(options.fileName || `Derbix_Analisis_${fixtureTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (e) {
        console.error("Error generando PDF Match Analysis:", e);
    }
};


/**
 * Genera PDF para Parlays (Smart & Manual)
 * Estilo: Portada + Resumen + Detalle por Selección
 */
export const generateParlayPDF = async (parlay: any, options: ReportOptions = {}) => {
    try {
        const doc = new jsPDF();
        const logo = await loadImage(LOGO_URL);
        const isSmart = parlay.strategy || parlay.confidence_tier;
        const title = options.titleOverride || (isSmart ? 'Informe de Smart Parlay' : 'Análisis de Parlay Personalizado');
        const prob = Math.round((parlay.combined_probability || parlay.win_probability) * 100);
        const subtitle = `Probabilidad Combinada: ${prob}% | Cuota: ${parlay.finalOdds || parlay.combined_odds || '-'}`;
        const dateStr = formatDate(new Date());

        // --- PÁGINA 1: PORTADA ---
        addCoverPage(doc, title, subtitle, logo, dateStr, false);

        // --- PÁGINA 2: RESUMEN ESTRATÉGICO ---
        doc.addPage();
        let y = addPageHeader(doc, 'Resumen Estratégico', logo);
        addFooter(doc, 2);

        y = addSectionTitle(doc, 'Tesis de Inversión', y);

        const defaultJustification = "Esta combinación ha sido seleccionada tras un análisis exhaustivo de correlaciones y valor esperado negativo en las cuotas ofrecidas por el mercado.";
        const justification = parlay.justification || parlay.overallStrategy || parlay.strategy || defaultJustification;
        y = addParagraph(doc, justification, y);
        y += 6;

        // Métricas Clave
        drawMetricBox(doc, 'PROBABILIDAD', `${prob}%`, MARGIN, y, 55, COLORS.primary);
        drawMetricBox(doc, 'CUOTA TOTAL', `${parlay.finalOdds || '-'}`, 77, y, 55, COLORS.accent);
        drawMetricBox(doc, 'SELECCIONES', `${(parlay.picks || parlay.legs || []).length}`, 140, y, 55, COLORS.brandBlue);
        y += 35;

        // Tabla Resumen
        y = addSectionTitle(doc, 'Desglose de Selecciones', y);

        const picks = parlay.picks || parlay.legs || [];
        const tableBody = picks.map((p: any) => [
            `${p.home_team || p.home || 'Local'} vs ${p.away_team || p.away || 'Visitante'}`,
            p.market || p.selection,
            p.selection || p.prediction,
            p.odds ? `@${p.odds}` : '-'
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Encuentro', 'Mercado', 'Selección', 'Cuota']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: COLORS.secondary },
            styles: { fontSize: 10, cellPadding: 4 }
        });

        // --- PÁGINAS DE DETALLE ---
        // @ts-ignore
        y = doc.lastAutoTable.finalY + 20;

        picks.forEach((pick: any, index: number) => {
            if (y > 220 || index === 0) {
                doc.addPage();
                y = addPageHeader(doc, 'Análisis Profundo por Selección', logo);
                addFooter(doc, doc.getNumberOfPages());
            }

            // Header del Pick
            doc.setFillColor(COLORS.secondary);
            doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 1, 1, 'F');
            doc.setTextColor(COLORS.white);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`SELECCIÓN #${index + 1}: ${pick.home_team || 'Home'} vs ${pick.away_team || 'Away'}`, MARGIN + 4, y + 8);
            y += 18;

            // Datos del Pick
            doc.setTextColor(COLORS.text);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`Mercado: ${pick.market}`, MARGIN, y);
            doc.setTextColor(COLORS.accent);
            doc.text(`Pronóstico: ${pick.selection}`, 100, y);
            doc.setTextColor(COLORS.text);

            if (pick.p_model || pick.probability) {
                doc.text(`Probabilidad: ${Math.round((pick.p_model || pick.probability) * 100)}%`, MARGIN, y + 6);
            }
            y += 15;

            // Razonamiento
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('RAZONAMIENTO:', MARGIN, y);
            y += 6;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.secondary);
            const reasoning = pick.argument || pick.reasoning || "Análisis basado en tendencias estadísticas recientes.";
            const splitReason = wrapText(doc, reasoning, CONTENT_WIDTH);
            doc.text(splitReason, MARGIN, y);
            y += splitReason.length * 5 + 15;

            // Separador
            if (y < 220 && index < picks.length - 1) {
                doc.setDrawColor(COLORS.border);
                doc.line(MARGIN, y - 5, PAGE_WIDTH - MARGIN, y - 5);
                y += 5;
            }
        });

        doc.save(options.fileName || 'reporte_derbix.pdf');
    } catch (e) {
        console.error("Error generando PDF Parlay:", e);
        alert("Hubo un error generando el reporte PDF. Revisa la consola.");
    }
};
