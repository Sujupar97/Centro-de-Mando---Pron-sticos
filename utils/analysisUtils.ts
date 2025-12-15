import { Bet, PeriodStats, BetStatus, LegStatus } from '../types';

// Helper para obtener el número de semana ISO
const getWeek = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Corrección para el cálculo de la semana
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

// Helper para obtener el primer día de una semana ISO
const getStartOfWeek = (year: number, week: number): Date => {
    const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const day = d.getUTCDay() || 7;
    if(day !== 1) d.setUTCDate(d.getUTCDate() - day + 1);
    return d;
};


type Period = 'weekly' | 'monthly';

export const calculatePeriodicStats = (bets: Bet[], period: Period): PeriodStats[] => {
    const groupedBets: { [key: string]: Bet[] } = {};

    bets.forEach(bet => {
        const date = new Date(bet.date);
        let key: string;
        if (period === 'weekly') {
            const year = date.getUTCFullYear();
            const week = getWeek(date);
            key = `${year}-W${week.toString().padStart(2, '0')}`;
        } else {
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth() + 1;
            key = `${year}-M${month.toString().padStart(2, '0')}`;
        }
        if (!groupedBets[key]) {
            groupedBets[key] = [];
        }
        groupedBets[key].push(bet);
    });

    return Object.keys(groupedBets).map(key => {
        const periodBets = groupedBets[key];
        const stats: PeriodStats = {
            period: '',
            totalBets: periodBets.length,
            combinedBets: 0,
            singleBets: 0,
            wonBets: 0,
            lostBets: 0,
            winRate: 0,
            totalLegs: 0,
            wonLegs: 0,
            lostLegs: 0,
            legWinRate: 0,
            totalStaked: 0,
            totalPayout: 0,
            profitLoss: 0,
            roi: 0,
            averageOdds: 0
        };

        if (period === 'weekly') {
            const [year, weekStr] = key.split('-W');
            const week = parseInt(weekStr, 10);
            const startDate = getStartOfWeek(parseInt(year, 10), week);
            stats.period = `Semana del ${startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
        } else {
            const [year, monthStr] = key.split('-M');
            const date = new Date(parseInt(year, 10), parseInt(monthStr, 10) - 1);
            stats.period = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        }


        periodBets.forEach(bet => {
            const isCombined = bet.legs && bet.legs.length > 1;
            if (isCombined) {
                stats.combinedBets += 1;
            } else {
                stats.singleBets += 1;
            }

            if (bet.status === BetStatus.Won) stats.wonBets += 1;
            if (bet.status === BetStatus.Lost) stats.lostBets += 1;

            stats.totalStaked += bet.stake;
            stats.totalPayout += bet.payout;
            stats.averageOdds += bet.odds;

            if (bet.legs) {
                bet.legs.forEach(leg => {
                    if (leg.status === LegStatus.Won || leg.status === LegStatus.Lost) {
                       stats.totalLegs += 1;
                       if (leg.status === LegStatus.Won) stats.wonLegs += 1;
                       if (leg.status === LegStatus.Lost) stats.lostLegs += 1;
                    }
                });
            }
        });
        
        const settledBetsCount = stats.wonBets + stats.lostBets;
        stats.winRate = settledBetsCount > 0 ? (stats.wonBets / settledBetsCount) * 100 : 0;
        stats.legWinRate = stats.totalLegs > 0 ? (stats.wonLegs / stats.totalLegs) * 100 : 0;
        stats.profitLoss = stats.totalPayout - stats.totalStaked;
        stats.roi = stats.totalStaked > 0 ? (stats.profitLoss / stats.totalStaked) * 100 : 0;
        stats.averageOdds = periodBets.length > 0 ? stats.averageOdds / periodBets.length : 0;

        return stats;
    }).sort((a, b) => b.period.localeCompare(a.period)); // Ordenar por fecha descendente
};