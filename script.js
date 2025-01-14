// Remove particles.js configuration and add floating cats
document.addEventListener('DOMContentLoaded', async () => {
    // Create floating cats background
    const cybercatsBg = document.createElement('div');
    cybercatsBg.className = 'cyber-cats-bg';
    document.body.appendChild(cybercatsBg);

    // Create more cats for better effect
    for (let i = 0; i < 30; i++) {
        cybercatsBg.appendChild(createFloatingCat());
    }
    
    // Add new cats more frequently
    setInterval(() => {
        if (cybercatsBg.children.length < 35) {
            cybercatsBg.appendChild(createFloatingCat());
        }
    }, 3000);
    
    // Remove excess cats less frequently
    setInterval(() => {
        while (cybercatsBg.children.length > 35) {
            cybercatsBg.removeChild(cybercatsBg.firstChild);
        }
    }, 15000);

    // Fetch GitHub data and update UI
    const repos = await fetchGitHubStats();
    if (repos) {
        await updateFeaturedProjects(repos);
        await fetchProjects(); // Your existing function to show all projects
    }
});

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Update the floating cats creation
function createFloatingCat() {
    const cat = document.createElement('div');
    cat.className = 'floating-cat';
    
    // Only use cat icons
    cat.innerHTML = '<i class="fas fa-cat fa-fw"></i>';
    
    // Random size class with adjusted sizes
    const sizes = ['tiny', 'small', 'normal', 'large', 'huge'];
    const sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
    cat.classList.add(sizeClass);
    
    // Random color class with only purple and red variants
    const colors = [
        'primary',        // Purple
        'primary-light',  // Light Purple
        'secondary',      // Red
        'accent'         // Bright Red
    ];
    const colorClass = colors[Math.floor(Math.random() * colors.length)];
    cat.classList.add(colorClass);
    
    // More spread out random positioning
    cat.style.left = `${Math.random() * 95}%`;
    cat.style.top = `${Math.random() * 95}%`;
    
    // Random animation with adjusted timing
    const animations = ['floatAroundA', 'floatAroundB', 'floatAroundC'];
    const animation = animations[Math.floor(Math.random() * animations.length)];
    
    // Slower, more varied movement
    const duration = 20 + Math.random() * 30;
    const delay = Math.random() * -30;
    
    cat.style.animation = `${animation} ${duration}s linear infinite`;
    cat.style.animationDelay = `${delay}s`;
    
    return cat;
}

// Update the project card creation
function createProjectCard(repo) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    const languageColor = {
        'JavaScript': '#f1e05a',
        'Python': '#3572A5',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'TypeScript': '#2b7489'
    }[repo.language] || '#b829e3';

    card.innerHTML = `
        <div class="card-header">
            <h3 title="${repo.name}">${repo.name}</h3>
        </div>
        
        <div class="card-content">
            <p class="description" title="${repo.description || 'No description available'}">
                ${repo.description || 'No description available'}
            </p>
            
            <div class="stats">
                <span title="Stars">
                    <i class="fas fa-star"></i>
                    ${repo.stargazers_count}
                </span>
                <span title="Forks">
                    <i class="fas fa-code-branch"></i>
                    ${repo.forks_count}
                </span>
                ${repo.language ? `
                    <span title="Primary Language">
                        <span style="background-color: ${languageColor};"></span>
                        ${repo.language}
                    </span>
                ` : ''}
            </div>
        </div>
        
        <div class="card-footer">
            <a href="${repo.html_url}" target="_blank" class="view-project">
                <i class="fab fa-github"></i>
                View Project
            </a>
        </div>
    `;
    
    return card;
}

// GitHub API configuration
const GITHUB_USERNAME = 'DevelopmentCats';
const FEATURED_TOPICS = ['featured'];
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const IGNORED_REPOS = [
    'developmentcats.github.io', // Your profile repo
    // Add any other repos you want to ignore here
];

// Cache management
function getFromCache(key) {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
    }
    return data;
}

function setCache(key, data) {
    localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
}

// Fetch with pagination and rate limit handling
async function githubFetch(url) {
    const response = await fetch(url);
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    
    if (response.status === 403 && remaining === '0') {
        const resetDate = new Date(reset * 1000);
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`);
    }
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }

    // Get the Link header to handle pagination
    const linkHeader = response.headers.get('Link');
    const data = await response.json();
    
    return { data, linkHeader };
}

// Parse GitHub's Link header
function parseLinkHeader(linkHeader) {
    if (!linkHeader) return {};
    
    return linkHeader.split(',').reduce((acc, link) => {
        const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
        if (match) acc[match[2]] = match[1];
        return acc;
    }, {});
}

// Fetch all pages of repositories
async function fetchAllRepos() {
    let url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100`;
    let allRepos = [];
    
    while (url) {
        const { data, linkHeader } = await githubFetch(url);
        allRepos = [...allRepos, ...data];
        
        const links = parseLinkHeader(linkHeader);
        url = links.next; // Will be undefined when there are no more pages
    }
    
    return allRepos;
}

// Fetch GitHub stats and update the UI
async function fetchGitHubStats() {
    try {
        // Check cache first
        const cachedStats = getFromCache('github_stats');
        const cachedRepos = getFromCache('github_repos');
        
        if (cachedStats && cachedRepos) {
            updateStatsUI(cachedStats, cachedRepos);
            return cachedRepos;
        }

        // Fetch fresh data if cache miss
        const [userData, reposData] = await Promise.all([
            githubFetch(`https://api.github.com/users/${GITHUB_USERNAME}`).then(res => res.data),
            fetchAllRepos()
        ]);

        // Cache the results
        setCache('github_stats', userData);
        setCache('github_repos', reposData);
        
        updateStatsUI(userData, reposData);
        return reposData;
    } catch (error) {
        console.error('Error fetching GitHub stats:', error);
        showError('.stats-section', error.message);
    }
}

function updateStatsUI(userData, reposData) {
    const statsSection = document.querySelector('.stats-section .github-stats');
    if (!statsSection) {
        console.warn('Stats section not found in the DOM');
        return;
    }

    const repoCountElement = statsSection.querySelector('.stat-item:first-child .stat-value');
    const starsCountElement = statsSection.querySelector('.stat-item:last-child .stat-value');

    if (repoCountElement && starsCountElement) {
        const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        repoCountElement.textContent = userData.public_repos;
        starsCountElement.textContent = totalStars;
    } else {
        console.warn('Stats elements not found in the DOM');
    }
}

function showError(selector, message) {
    const element = document.querySelector(selector);
    element.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

// Filter repositories based on ignore list
function filterRepos(repos) {
    return repos.filter(repo => 
        !repo.fork && 
        !IGNORED_REPOS.includes(repo.name) &&
        !repo.private
    );
}

// Update featured projects section
async function updateFeaturedProjects(repos) {
    const featuredSection = document.querySelector('.featured-projects');
    featuredSection.innerHTML = ''; // Clear existing content

    try {
        // Use cached repos if available
        const reposToUse = repos || getFromCache('github_repos');
        if (!reposToUse) {
            throw new Error('No repository data available');
        }

        // Filter featured repos (those with the most stars or specific topics)
        const filteredRepos = filterRepos(reposToUse);
        const featuredRepos = filteredRepos
            .filter(repo => repo.topics && FEATURED_TOPICS.some(topic => repo.topics.includes(topic)))
            .sort((a, b) => b.stargazers_count - a.stargazers_count)
            .slice(0, 3);

        if (featuredRepos.length === 0) {
            // Fallback to most starred repos if no featured ones
            featuredRepos.push(...filteredRepos
                .sort((a, b) => b.stargazers_count - a.stargazers_count)
                .slice(0, 3)
            );
        }

        featuredRepos.forEach(repo => {
            const featuredItem = document.createElement('a');
            featuredItem.href = repo.html_url;
            featuredItem.target = '_blank';
            featuredItem.className = 'featured-item';

            // Choose icon based on repo topics or language
            let icon = 'code';
            if (repo.topics) {
                if (repo.topics.includes('ai')) icon = 'robot';
                else if (repo.topics.includes('web')) icon = 'globe';
                else if (repo.topics.includes('tool')) icon = 'wrench';
            }

            featuredItem.innerHTML = `
                <i class="fas fa-${icon}"></i>
                <div class="project-details">
                    <h3>${repo.name}</h3>
                    <p>${repo.description || 'No description available'}</p>
                </div>
            `;

            featuredSection.appendChild(featuredItem);
        });
    } catch (error) {
        console.error('Error updating featured projects:', error);
        showError('.featured-projects', error.message);
    }
}

// Fetch and display GitHub repositories
async function fetchProjects() {
    const projectsContainer = document.getElementById('projects-container');
    
    try {
        // Use cached repos if available
        const repos = getFromCache('github_repos');
        if (!repos) {
            const response = await githubFetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100`);
            setCache('github_repos', response);
            displayProjects(response, projectsContainer);
        } else {
            displayProjects(repos, projectsContainer);
        }
    } catch (error) {
        console.error('Error fetching repositories:', error);
        showError('#projects-container', error.message);
    }
}

function displayProjects(repos, container) {
    container.innerHTML = ''; // Clear existing content
    
    // Sort repos by stars
    filterRepos(repos)
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .forEach(repo => {
            const card = createProjectCard(repo);
            container.appendChild(card);
        });
} 