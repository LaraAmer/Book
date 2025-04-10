const express = require('express');
const axios = require('axios');
const inquirer = require('inquirer');
const app = express();
const port = 5000;

// Command line interface
const args = process.argv.slice(2);
if (args.length > 0) {
    const command = args[0];
    
    if (command === 'info-book-item-number') {
        inquirer.prompt([
            {
                type: 'input',
                name: 'id',
                message: 'please enter item number to get info about it:'
            }
        ]).then(answers => {
            axios.get(`http://catalog:3000/info/${answers.id}`)
                .then(response => {
                    console.log('Response Data:', response.data);
                })
                .catch(error => {
                    console.error('Error:', error.response ? error.response.data : error.message);
                });
        });
    } else if (command === 'purchase-book-by-item-number') {
        inquirer.prompt([
            {
                type: 'input',
                name: 'id',
                message: 'please enter book item number to purchase it:'
            }
        ]).then(answers => {
            axios.post(`http://order:4000/purchase/${answers.id}`)
                .then(response => {
                    console.log('Response Data:', response.data);
                })
                .catch(error => {
                    console.error('Error:', error.response ? error.response.data : error.message);
                });
        });
    } else if (command === 'search-book-title') {
        inquirer.prompt([
            {
                type: 'input',
                name: 'topic',
                message: 'please enter book topic to get details about it:'
            }
        ]).then(answers => {
            axios.get(`http://catalog:3000/search/${answers.topic}`)
                .then(response => {
                    console.log('Response Data:', response.data);
                })
                .catch(error => {
                    console.error('Error:', error.response ? error.response.data : error.message);
                });
        });
    }
}

// HTTP API
app.get('/info/:id', async (req, res) => {
    try {
        const response = await axios.get(`http://catalog:3000/info/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || {error: error.message});
    }
});

app.get('/search/:topic', async (req, res) => {
    try {
        const response = await axios.get(`http://catalog:3000/search/${req.params.topic}`);
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || {error: error.message});
    }
});

app.post('/purchase/:id', async (req, res) => {
    try {
        const response = await axios.post(`http://order:4000/purchase/${req.params.id}`);
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || {error: error.message});
    }
});

app.listen(port, () => {
    console.log(`Client server running on port ${port}...`);
});