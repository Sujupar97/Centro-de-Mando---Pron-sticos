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
    brandBlue: '#3B82F6'  // Blue 500
};

const LOGO_URL = '/derbix-logo.png'; // Ruta pública del logo

// --- TIPOS ---
interface ReportOptions {
    fileName?: string;
    titleOverride?: string;
}

// --- UTILIDADES ---
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`[PDF] No se pudo cargar la imagen: ${url}`);
            // Resolvemos con una imagen vacía 1x1 para no romper el flujo
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
    return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// --- COMPONENTES DE DISEÑO ---

// 1. PORTADA
const addCoverPage = (doc: jsPDF, title: string, subtitle: string, logo: HTMLImageElement, date: string) => {
    const width = doc.internal.pageSize.width;
    const height = doc.internal.pageSize.height;

    // Fondo Principal (Dark Theme)
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, width, height, 'F');

    // Acentos Geométricos (Esquinas)
    doc.setFillColor(COLORS.accent);
    // Triángulo superior derecho
    doc.triangle(width, 0, width - 60, 0, width, 60, 'F');
    // Línea inferior
    doc.rect(0, height - 15, width, 15, 'F');

    // Logo (Centrado Superior)
    if (logo.width > 1) {
        const logoWidth = 60;
        const logoHeight = (logo.height / logo.width) * logoWidth;
        const x = (width - logoWidth) / 2;
        doc.addImage(logo, 'PNG', x, 40, logoWidth, logoHeight);
    } else {
        // Fallback texto si no carga logo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(40);
        doc.setTextColor(COLORS.white);
        doc.text('DERBIX', width / 2, 60, { align: 'center' });
    }

    // Título Principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(COLORS.white);
    doc.text(title, width / 2, 120, { align: 'center', maxWidth: width - 40 });

    // Subtítulo / Contexto
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(COLORS.lightText);
    doc.text(subtitle, width / 2, 140, { align: 'center', maxWidth: width - 50 });

    // Línea Divisoria
    doc.setDrawColor(COLORS.accent);
    doc.setLineWidth(1);
    doc.line(width / 2 - 30, 155, width / 2 + 30, 155);

    // Fecha / ID
    doc.setFontSize(12);
    doc.setTextColor(COLORS.white);
    doc.text(`Fecha de Emisión: ${date}`, width / 2, 170, { align: 'center' });
    doc.text(`ID de Informe: DBX-${Math.floor(Math.random() * 10000)}`, width / 2, 180, { align: 'center' });

    // Footer de Portada
    doc.setFontSize(10);
    doc.setTextColor(COLORS.lightText);
    doc.text('INTELIGENCIA ARTIFICIAL APLICADA AL DEPORTE', width / 2, height - 25, { align: 'center' });
};

// 2. HEADER PARA PÁGINAS INTERNAS
const addPageHeader = (doc: jsPDF, title: string, logo: HTMLImageElement) => {
    const width = doc.internal.pageSize.width;

    // Logo pequeño izquierda
    if (logo.width > 1) {
        const logoW = 25;
        const logoH = (logo.height / logo.width) * logoW;
        doc.addImage(logo, 'PNG', 14, 10, logoW, logoH);
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(COLORS.primary);
        doc.text('DERBIX', 14, 20);
    }

    // Título Derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(COLORS.primary);
    doc.text(title, width - 14, 18, { align: 'right' });

    // Línea separadora
    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(14, 25, width - 14, 25);

    return 35; // Start Y position
};

// 3. FOOTER
const addFooter = (doc: jsPDF, pageNumber: number) => {
    const width = doc.internal.pageSize.width;
    const height = doc.internal.pageSize.height;

    doc.setDrawColor(COLORS.border);
    doc.line(14, height - 15, width - 14, height - 15);

    doc.setFontSize(8);
    doc.setTextColor(COLORS.lightText);
    doc.text(`Confidencial - Propiedad de Derbix AI © ${new Date().getFullYear()}`, 14, height - 10);
    doc.text(`Página ${pageNumber}`, width - 14, height - 10, { align: 'right' });
};

// --- GENERADORES PRINCIPALES ---

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
        addCoverPage(doc, title, subtitle, logo, dateStr);

        // --- PÁGINA 2: RESUMEN ESTRATÉGICO ---
        doc.addPage();
        let y = addPageHeader(doc, 'Resumen Estratégico', logo);

        // Título de Sección
        doc.setFontSize(14);
        doc.setTextColor(COLORS.primary);
        doc.text('TESIS DE INVERSIÓN', 14, y);
        y += 8;

        // Texto de Justificación
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(COLORS.text);

        const defaultJustification = "Esta combinación ha sido seleccionada tras un análisis exhaustivo de correlaciones y valor esperado negativo en las cuotas ofrecidas por el mercado. El sistema identifica discrepancias entre la probabilidad real calculada por nuestros modelos y la probabilidad implícita en las casas de apuestas.";
        const justification = parlay.justification || parlay.overallStrategy || parlay.strategy || defaultJustification;

        const splitText = doc.splitTextToSize(justification, 180);
        doc.text(splitText, 14, y);
        y += splitText.length * 5 + 10;

        // Métricas Clave (Cajas)
        const drawMetric = (label: string, value: string, x: number, color: string) => {
            doc.setFillColor(color);
            doc.roundedRect(x, y, 55, 25, 3, 3, 'F');
            doc.setTextColor(COLORS.white);
            doc.setFontSize(9);
            doc.text(label, x + 27.5, y + 8, { align: 'center' });
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(value, x + 27.5, y + 18, { align: 'center' });
        };

        drawMetric('PROBABILIDAD', `${prob}%`, 14, COLORS.primary);
        drawMetric('CUOTA TOTAL', `${parlay.finalOdds || '-'}`, 77, COLORS.accent);
        drawMetric('PICK COUNT', `${(parlay.picks || parlay.legs || []).length} Selecciones`, 140, COLORS.brandBlue);

        y += 35;

        // Tabla Resumen
        doc.setFontSize(12);
        doc.setTextColor(COLORS.primary);
        doc.text('DESGLOSE DE SELECCIONES', 14, y);
        y += 5;

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

        addFooter(doc, 2);

        // --- PÁGINAS DE DETALLE (1 o 2 picks por página) ---
        // @ts-ignore
        y = doc.lastAutoTable.finalY + 20;

        picks.forEach((pick: any, index: number) => {
            // Si falta espacio, nueva página
            if (y > 220) {
                doc.addPage();
                y = addPageHeader(doc, 'Análisis Detallado', logo);
                addFooter(doc, doc.getNumberOfPages());
            } else if (index === 0) {
                // Primera página después de la tabla, a veces queremos saltar si está muy lleno
                // Pero dejemos que fluya si cabe
                doc.addPage(); // Mejor una página limpia para el detalle profundo
                y = addPageHeader(doc, 'Análisis Profundo por Selección', logo);
                addFooter(doc, doc.getNumberOfPages());
            }

            // Header del Pick (Caja Gris)
            doc.setFillColor(COLORS.secondary);
            doc.roundedRect(14, y, 182, 12, 1, 1, 'F');
            doc.setTextColor(COLORS.white);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`SELECCIÓN #${index + 1}: ${pick.home_team || 'Home'} vs ${pick.away_team || 'Away'}`, 18, y + 8);

            y += 20;

            // Datos del Pick
            doc.setTextColor(COLORS.text);
            doc.setFont('helvetica', 'bold');
            doc.text(`Mercado: ${pick.market}`, 14, y);
            doc.setTextColor(COLORS.accent);
            doc.text(`Pronóstico: ${pick.selection}`, 100, y);
            doc.setTextColor(COLORS.text);

            if (pick.p_model || pick.probability) {
                doc.text(`Probabilidad Modelo: ${Math.round((pick.p_model || pick.probability) * 100)}%`, 14, y + 6);
            }

            y += 15;

            // Razonamiento
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('RAZONAMIENTO ANALÍTICO:', 14, y);
            y += 6;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.secondary);
            const reasoning = pick.argument || pick.reasoning || "Análisis basado en tendencias estadísticas recientes y métricas de rendimiento comparativo.";
            const splitReason = doc.splitTextToSize(reasoning, 180);
            doc.text(splitReason, 14, y);

            y += splitReason.length * 5 + 15;

            // Línea separadora suave si hay otro pick en la misma página
            if (y < 220 && index < picks.length - 1) {
                doc.setDrawColor(COLORS.border);
                doc.line(14, y - 5, 196, y - 5);
                y += 5;
            }
        });

        doc.save(options.fileName || 'reporte_derbix.pdf');
    } catch (e) {
        console.error("Error generando PDF Premium:", e);
        // Fallback básico por si falla la carga de imagen u otra cosa
        alert("Hubo un error generando el reporte PDF. Revisa la consola.");
    }
};

/**
 * Genera PDF para Análisis de Partido Individual (Match Analysis)
 */
export const generateMatchAnalysisPDF = async (analysisRun: any, options: ReportOptions = {}) => {
    try {
        const doc = new jsPDF();
        const logo = await loadImage(LOGO_URL);
        const data = analysisRun.report_pre_jsonb || {};

        // Extraer título
        let fixtureTitle = data.header_partido?.titulo || 'Análisis de Partido';
        if (!data.header_partido) {
            const ctx = data.contexto_competitivo || {};
            fixtureTitle = `${ctx.situacion_local?.split(' vs ')[0] || 'Local'} vs ${ctx.situacion_visitante?.split(' vs ')[1] || 'Visitante'}`;
        }

        const dateStr = formatDate(new Date());

        // --- PÁGINA 1: PORTADA ---
        addCoverPage(doc, "Informe de Análisis Táctico", fixtureTitle, logo, dateStr);

        // --- PÁGINA 2: RESUMEN EJECUTIVO ---
        doc.addPage();
        let y = addPageHeader(doc, 'Resumen Ejecutivo', logo);
        addFooter(doc, 2);

        // Frase Principal
        if (data.resumen_ejecutivo?.frase_principal || data.resumen_ejecutivo?.titular) {
            doc.setFontSize(18);
            doc.setTextColor(COLORS.primary);
            doc.setFont('helvetica', 'bold');
            const titulo = data.resumen_ejecutivo?.frase_principal || data.resumen_ejecutivo?.titular;
            const splitT = doc.splitTextToSize(`"${titulo}"`, 180);
            doc.text(splitT, 14, y + 10);
            y += splitT.length * 8 + 15;
        }

        // Puntos Clave
        if (data.resumen_ejecutivo?.puntos_clave) {
            doc.setFontSize(11);
            doc.setTextColor(COLORS.text);
            data.resumen_ejecutivo.puntos_clave.forEach((point: string) => {
                const splitP = doc.splitTextToSize(`• ${point}`, 175);
                doc.text(splitP, 19, y);
                y += splitP.length * 6;
            });
            y += 10;
        }

        // Tabla de Oportunidades (Value Picks)
        if (data.analisis_mercados_calculados?.top_oportunidades) {
            y += 5;
            doc.setFontSize(12);
            doc.setTextColor(COLORS.primary);
            doc.setFont('helvetica', 'bold');
            doc.text('OPORTUNIDADES DE VALOR DETECTADAS', 14, y);
            y += 5;

            const tableBody = data.analisis_mercados_calculados.top_oportunidades.slice(0, 5).map((p: any) => [
                p.mercado,
                `${p.probabilidad_calculada}%`,
                `+${p.value_score}%`,
                p.confianza
            ]);

            autoTable(doc, {
                startY: y,
                head: [['Mercado', 'Probabilidad', 'Valor (Edge)', 'Confianza']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: COLORS.accent },
                styles: { fontSize: 10, cellPadding: 3 }
            });
            // @ts-ignore
            y = doc.lastAutoTable.finalY + 15;
        }

        // --- PÁGINA 3: ANÁLISIS TÁCTICO & DATA ---
        doc.addPage();
        y = addPageHeader(doc, 'Profundidad Táctica', logo);
        addFooter(doc, 3);

        const sections = [
            { title: 'Contexto Competitivo', content: [data.contexto_competitivo?.situacion_local, data.contexto_competitivo?.situacion_visitante] },
            { title: 'Análisis Táctico', content: [data.analisis_tactico?.matchup || (typeof data.analisis_tactico === 'string' ? data.analisis_tactico : '')] }
        ];

        sections.forEach(sec => {
            doc.setFontSize(13);
            doc.setTextColor(COLORS.secondary);
            doc.setFont('helvetica', 'bold');
            doc.text(sec.title.toUpperCase(), 14, y);
            y += 8;

            doc.setFontSize(10);
            doc.setTextColor(COLORS.text);
            doc.setFont('helvetica', 'normal');

            sec.content.forEach(c => {
                if (!c) return;
                const txt = doc.splitTextToSize(c, 180);
                doc.text(txt, 14, y);
                y += txt.length * 5 + 5;
            });
            y += 5;
        });

        // Stats Finales
        if (data.analisis_mercados_calculados?.resumen) {
            // Mini grid de stats si cabe
            const stats = data.analisis_mercados_calculados.resumen;
            doc.setFillColor(COLORS.secondary);
            doc.rect(14, y, 182, 25, 'F');

            doc.setTextColor(COLORS.white);
            doc.setFontSize(9);
            doc.text(`xG: ${stats.goles_esperados?.toFixed(2) || '-'}`, 30, y + 15);
            doc.text(`xCorners: ${stats.corners_esperados?.toFixed(2) || '-'}`, 80, y + 15);
            doc.text(`xCards: ${stats.tarjetas_esperadas?.toFixed(2) || '-'}`, 130, y + 15);
        }

        doc.save(options.fileName || `analisis_${fixtureTitle.replace(/ /g, '_')}.pdf`);

    } catch (e) {
        console.error("Error generando PDF Match Analysis:", e);
    }
};
