class Leaderboard {
    constructor() {
        this.leaderboardKey = 'weboccult-face-pong-leaderboard';
        this.maxEntries = 10;
        this.entries = this.loadLeaderboard();
    }

    loadLeaderboard() {
        try {
            const storedData = localStorage.getItem(this.leaderboardKey);
            return storedData ? JSON.parse(storedData) : [];
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            return [];
        }
    }

    saveLeaderboard() {
        try {
            localStorage.setItem(this.leaderboardKey, JSON.stringify(this.entries));
        } catch (error) {
            console.error('Error saving leaderboard:', error);
        }
    }

    addScore(name, time, email = '') {
        console.log('Adding score to leaderboard:', name, time);
        const newEntry = {
            name: name || 'Anonymous',
            time: parseFloat(time) || 0,
            email: email || '',
            date: new Date().toISOString().split('T')[0]
        };

        this.entries.push(newEntry);
        
        // Sort by time (descending)
        this.entries.sort((a, b) => b.time - a.time);
        
        // Keep only top entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }
        
        this.saveLeaderboard();
        
        // Update high score message if available
        const highScoreMessage = document.getElementById('high-score-message');
        if (highScoreMessage) {
            const rank = this.getPlayerRank(newEntry);
            if (rank === 1) {
                highScoreMessage.textContent = 'Congratulations! You got the top score!';
            } else if (rank <= this.maxEntries) {
                highScoreMessage.textContent = `Congratulations! You ranked #${rank} on the leaderboard!`;
            } else {
                highScoreMessage.textContent = '';
            }
        }
        
        return this.getPlayerRank(newEntry);
    }

    getPlayerRank(entry) {
        return this.entries.findIndex(e => 
            e.name === entry.name && 
            e.time === entry.time && 
            e.date === entry.date
        ) + 1;
    }

    isHighScore(time) {
        if (this.entries.length < this.maxEntries) {
            return true;
        }
        return time > this.entries[this.entries.length - 1].time;
    }

    getTopEntries(count = this.maxEntries) {
        return this.entries.slice(0, count);
    }

    renderLeaderboard(tableBodyId) {
        console.log('Rendering leaderboard in:', tableBodyId);
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) {
            console.error('Leaderboard table body not found:', tableBodyId);
            return;
        }
        
        tableBody.innerHTML = '';
        
        if (this.entries.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = 3;
            emptyCell.textContent = 'No scores yet. Be the first!';
            emptyCell.style.textAlign = 'center';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);
            return;
        }
        
        this.entries.forEach((entry, index) => {
            const row = document.createElement('tr');
            
            const rankCell = document.createElement('td');
            rankCell.textContent = index + 1;
            
            const nameCell = document.createElement('td');
            nameCell.textContent = entry.name;
            
            const timeCell = document.createElement('td');
            timeCell.textContent = entry.time.toFixed(2);
            
            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(timeCell);
            
            tableBody.appendChild(row);
        });
    }

    clearLeaderboard() {
        this.entries = [];
        this.saveLeaderboard();
    }
}