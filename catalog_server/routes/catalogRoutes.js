const express = require('express');
const router = express.Router();
const infoCont = require('../controllers/infoController');
const searchCont = require('../controllers/searchController');

router.get('/info/:id', infoCont.getInfo);
router.put('/updateCount/:id', infoCont.updatedCount);
router.get('/search/:topic', searchCont.bookSearch);

// Add this new route for cache invalidation
router.delete('/invalidateCache/:id', (req, res) => {
    const bookId = req.params.id;
    req.app.locals.cache.del(bookId);
    console.log("Cache invalidated for book ID:", bookId);
    res.status(200).json({ message: 'Cache invalidated successfully' });
});

module.exports = router;