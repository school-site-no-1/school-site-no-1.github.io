// server.js
const deployStatus = {};

app.post('/webhook/github', (req, res) => {
    const commitSha = req.body.after;
    deployStatus[commitSha] = { status: 'processing', timestamp: Date.now() };
    
    // Асинхронное обновление
    updateServer().then(() => {
        deployStatus[commitSha] = { status: 'deployed', updated: Date.now() };
    }).catch(err => {
        deployStatus[commitSha] = { status: 'error', error: err.message };
    });
    
    res.sendStatus(200);
});

app.get('/api/deploy-status/:sha', (req, res) => {
    const status = deployStatus[req.params.sha];
    if (status) {
        res.json(status);
    } else {
        res.status(404).json({ status: 'not_found' });
    }
});