require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const metricsRoutes = require('./routes/overviewRoutes/metricsRoutes');
const blockTradesRouter = require('./routes/blockTradesRoutes/blockTradesRouter');
const maxPainRoutes = require('./routes/maxPainRoutes');
const popularOptionsRouter = require('./routes/overviewRoutes/popularOptionsRouter');
const strikeActivityRouter = require('./routes/overviewRoutes/strikeActivityRouter');
const expirationRouter = require('./routes/expirationRoutes');
const expirationActivityRouter = require('./routes/overviewRoutes/expirationActivityRouter');
const strikeRouter = require('./routes/strikeRouter');
const timeDistributionRouter = require('./routes/overviewRoutes/timeDistributionRouter');
const keyMetricsRouter = require('./routes/overviewRoutes/keyMetricsRouter');
const popularOptionsBlockTradesRouter = require('./routes/blockTradesRoutes/popularOptionsBlockTradesRouter');
const strikeActivityBlockTradesRouter = require('./routes/blockTradesRoutes/strikeActivityBlockTradesRouter');
const expirationActivityBlockTradesRouter = require('./routes/blockTradesRoutes/expirationActivityBlockTradesRouter');
const timeDistributionBlockTradesRouter = require('./routes/blockTradesRoutes/timeDistributionBlockTradesRouter');
const keyMetricsBlockTradesRouter = require('./routes/blockTradesRoutes/keyMetricsBlockTradesRouter');
const openInterest = require('./routes/openInterestRoutes/openInterest');
const openInterestByExpirationRouter = require('./routes/openInterestRoutes/openInterestByExpirationRouter');
const openInterestByStrikeRouter = require('./routes/openInterestRoutes/openInterestByStrikeRouter');
const openInterestDeltaAdjusted = require('./routes/openInterestRoutes/openInterestDeltaAdjusted');
const openInterestHistorical = require('./routes/openInterestRoutes/openInterestHistorical');
const volumeInterestRouter = require('./routes/volumeRoutes/volumeInterestRouter');
const volumeByExpirationRouter = require('./routes/volumeRoutes/volumeByExpirationRouter');
const volumeByStrikeRouter = require('./routes/volumeRoutes/volumeByStrikeRouter');
const dataDownload = require('./routes/dataLabRoutes/dataDownload');
const flowMetricsRouter = require('./routes/flowRoutes/flowMetricsRouter');
const lastDataRouter = require('./routes/flowRoutes/lastDataRouter');
const flowDataRouter = require('./routes/flowRoutes/flowDataRouter');
const volumePopularOptionsRouter = require('./routes/volumeRoutes/volumePopularOptionsRouter');
const popularOptionByVolumeRouter = require('./routes/overviewRoutes/popularOptionByVolumeRouter');
const popularOptionByVolumeBlockTradesRouter = require('./routes/blockTradesRoutes/popularOptionByVolumeBlockTradesRouter');
const blockFlowDataRouter = require('./routes/blockFlowRoutes/blockFlowDataRouter');

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/metrics', metricsRoutes, popularOptionsRouter ,strikeActivityRouter, expirationActivityRouter, timeDistributionRouter,keyMetricsRouter, popularOptionByVolumeRouter);
app.use('/api/block-trades', blockTradesRouter, popularOptionsBlockTradesRouter, strikeActivityBlockTradesRouter, expirationActivityBlockTradesRouter, timeDistributionBlockTradesRouter, keyMetricsBlockTradesRouter, popularOptionByVolumeBlockTradesRouter);
app.use('/api', authRoutes, maxPainRoutes, expirationRouter, strikeRouter, flowDataRouter);
// for open interest
app.use('/api/open-interest', openInterest, openInterestByExpirationRouter, openInterestByStrikeRouter);
app.use('/api', openInterestDeltaAdjusted, openInterestHistorical);

app.use('/api/volume', volumeInterestRouter, volumeByExpirationRouter, volumeByStrikeRouter, volumePopularOptionsRouter);
app.use('/api/datalab', dataDownload);

app.use('/api/flow', flowMetricsRouter, lastDataRouter);
app.use('/api/block/flow', blockFlowDataRouter);



const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
