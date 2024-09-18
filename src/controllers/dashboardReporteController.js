import { Venta } from '../models/venta.model';
import { Producto } from '../models/producto.model';
import { Pago } from '../models/pago.model';
import { MovimientoInventario } from '../models/movimiento.model';
import { LoteProduccion } from '../models/loteproduccion.model';

// Helper function to calculate growth percentage
const calculateGrowth = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

// 1. Resumen del dashboard
export const getDashboardSummary = async (req, res) => {
    try {
        // Total de ventas
        const totalSales = await Venta.countDocuments();
        // Total de productos
        const totalProducts = await Producto.countDocuments();
        // Total de pagos
        const totalPayments = await Pago.countDocuments();
        // Total de movimientos de inventario
        const totalMovements = await MovimientoInventario.countDocuments();

        // Fecha de un mes atrás
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // Ventas de este mes y del mes pasado
        const salesThisMonth = await Venta.countDocuments({ fechaVenta: { $gte: oneMonthAgo } });
        const salesLastMonth = await Venta.countDocuments({ fechaVenta: { $lt: oneMonthAgo } });

        // Crecimiento en ventas
        const salesGrowth = calculateGrowth(salesThisMonth, salesLastMonth);

        // Respuesta con métricas del dashboard
        res.json({
            totalSales,
            totalProducts,
            totalPayments,
            totalMovements,
            salesThisMonth,
            salesGrowth
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el resumen del dashboard' });
    }
};

// 2. Estadísticas de ventas
export const getSalesStats = async (req, res) => {
    const { period } = req.query; // "day", "month", "year"
    try {
        if (!['day', 'month', 'year'].includes(period)) {
            return res.status(400).json({ error: 'El parámetro de período es inválido' });
        }

        let groupStage, sortStage;
        if (period === 'day') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fechaVenta" } }, total: { $sum: 1 } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'month') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fechaVenta" } }, total: { $sum: 1 } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'year') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y", date: "$fechaVenta" } }, total: { $sum: 1 } } };
            sortStage = { $sort: { "_id": 1 } };
        }

        const data = await Venta.aggregate([groupStage, sortStage]);
        res.json({ data: data.map(d => ({ name: d._id, total: d.total })) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas de ventas' });
    }
};

// 3. Estadísticas de productos (kilos vendidos, lotes en stock, lotes cercanos a expirar, productos a reabastecer)
export const getProductStats = async (req, res) => {
    const { period } = req.query;
    try {
        if (!['day', 'month', 'year'].includes(period)) {
            return res.status(400).json({ error: 'El parámetro de período es inválido' });
        }

        let groupStage, sortStage;
        if (period === 'day') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fechaVenta" } }, total: { $sum: "$productos.cantidad" } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'month') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fechaVenta" } }, total: { $sum: "$productos.cantidad" } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'year') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y", date: "$fechaVenta" } }, total: { $sum: "$productos.cantidad" } } };
            sortStage = { $sort: { "_id": 1 } };
        }

        const data = await Venta.aggregate([groupStage, sortStage]);

        // Lotes cercanos a expirar
        const today = new Date();
        const expiringLots = await LoteProduccion.find({
            fechaVencimiento: { $gte: today, $lte: new Date(today.setDate(today.getDate() + 30)) }
        });

        // Productos que necesitan reabastecimiento
        const productsToRestock = await Producto.find({ stockActual: { $lt: 'stockMinimo' } });

        res.json({
            soldProducts: data.map(d => ({ name: d._id, total: d.total })),
            expiringLots,
            productsToRestock
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas de productos' });
    }
};

// 4. Estadísticas de pagos
export const getPaymentStats = async (req, res) => {
    const { period } = req.query;
    try {
        if (!['day', 'month', 'year'].includes(period)) {
            return res.status(400).json({ error: 'El parámetro de período es inválido' });
        }

        let groupStage, sortStage;
        if (period === 'day') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fechaPago" } }, total: { $sum: "$montoPagado" } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'month') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fechaPago" } }, total: { $sum: "$montoPagado" } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'year') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y", date: "$fechaPago" } }, total: { $sum: "$montoPagado" } } };
            sortStage = { $sort: { "_id": 1 } };
        }

        const data = await Pago.aggregate([groupStage, sortStage]);
        res.json({ data: data.map(d => ({ name: d._id, total: d.total })) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas de pagos' });
    }
};

// 5. Estadísticas de movimientos de inventario
export const getMovementsStats = async (req, res) => {
    const { period } = req.query;
    try {
        if (!['day', 'month', 'year'].includes(period)) {
            return res.status(400).json({ error: 'El parámetro de período es inválido' });
        }

        let groupStage, sortStage;
        if (period === 'day') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fechaMovimiento" } }, total: { $sum: "$cantidad" } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'month') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fechaMovimiento" } }, total: { $sum: "$cantidad" } } };
            sortStage = { $sort: { "_id": 1 } };
        } else if (period === 'year') {
            groupStage = { $group: { _id: { $dateToString: { format: "%Y", date: "$fechaMovimiento" } }, total: { $sum: "$cantidad" } } };
            sortStage = { $sort: { "_id": 1 } };
        }

        const data = await MovimientoInventario.aggregate([groupStage, sortStage]);
        res.json({ data: data.map(d => ({ name: d._id, total: d.total })) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas de movimientos' });
    }
};
