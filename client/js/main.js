function toggleDetails(card) {
  const detail = card.querySelector(".match-details");
  detail.classList.toggle("visible");
}

function getChampImgName(name) {
  const overrides = {
    FiddleSticks: "Fiddlesticks",
    Wukong: "MonkeyKing",
    NunuWillump: "Nunu",
    Belveth: "Belveth",
    Kaisa: "Kaisa",
    Kogmaw: "KogMaw",
    AurelionSol: "AurelionSol",
  };
  return overrides[name] || name;
}

function daysAgoFromTimestamp(timestamp) {
  // Riot API gives gameEndTimestamp in ms, fallback to gameCreation if needed
  const matchTime = timestamp ? new Date(timestamp) : null;
  if (!matchTime) return "";
  const now = new Date();
  const diffMs = now - matchTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}
const summonerSpellMap = {
  21: "SummonerBarrier",
  1: "SummonerBoost",
  14: "SummonerDot",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  13: "SummonerMana",
  30: "SummonerPoroRecall",
  31: "SummonerPoroThrow",
  11: "SummonerSmite",
  39: "SummonerSnowURFSnowball_Mark",
  32: "SummonerSnowball",
  12: "SummonerTeleport",
};

const runeIconMap = {
  8100: "7200_Domination",
  8000: "7201_Precision",
  8200: "7202_Sorcery",
  8300: "7203_Whimsy",
  8400: "7204_Resolve",
};

async function getWinProbability(position, champA, champB) {
  console.log("Sending request to backend /api/predict ...");
  const res = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      position: position,
      champion_A: champA,
      champion_B: champB
    })
  });
  const result = await res.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.probability;
}

async function predictMatchup() {
  console.log("🔍 Button clicked");
  const position = document.getElementById("position").value;
  const champA = document.getElementById("championA").value.trim();
  const champB = document.getElementById("championB").value.trim();

  if (!champA || !champB) {
    document.getElementById("predictionResult").innerText =
      "Please enter both champion names.";
    return;
  }

  const prob = await getWinProbability(position, champA, champB);
  document.getElementById(
    "predictionResult"
  ).innerText = `${champA} win chance vs ${champB} in ${position}: ${(
    prob * 100
  ).toFixed(2)}%`;
}
async function fetchMatchStats() {
  const input = document.getElementById("riotId").value;
  const [gameName, tagLine] = input.split("#");
  if (!gameName || !tagLine) return alert("Invalid Riot ID");

  const res1 = await fetch(
    `/api/summoner/${gameName}/${tagLine}`
  );
  const summoner = await res1.json();
  const puuid = summoner.puuid;

  // 🆕 Fetch encryptedSummonerId from backend
  let encryptedSummonerId = null;
  try {
    const idRes = await fetch(`/api/summoner-id/${puuid}`);
    if (idRes.ok) {
      const idData = await idRes.json();
      encryptedSummonerId = idData.id;
    }
  } catch (e) {
    encryptedSummonerId = null;
  }

  // 🆕 Fetch ranked info and display it (with error handling)
  let rankedData = [];
  if (encryptedSummonerId) {
    try {
      const rankedRes = await fetch(`/api/ranked/${encryptedSummonerId}`);
      if (rankedRes.ok) {
        rankedData = await rankedRes.json();
      }
    } catch (e) {
      rankedData = [];
    }
  }
  displayRankedInfo(rankedData);

  //  Get filters from the user
  const mode = document.getElementById("gameModeSelect").value;
  const count = document.getElementById("gameCount").value || 20;

  // ✅ Request filtered matches from backend
  const res2 = await fetch(
    `/api/matches/${puuid}?count=${count}&mode=${mode}`
  );
  const matches = await res2.json();

  const container = document.getElementById("matchContainer");
  container.innerHTML = "";

  // Use the template
  const template = document.getElementById("match-card-template");

  let totalDealt = 0;
  let totalTaken = 0;
  let totalMitigated = 0;
  let totalHealing = 0;
  let wins = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;

  for (const match of matches) {
    const player = match.info.participants.find((p) => p.puuid === puuid);
    if (!player) continue;
    const redTeam = match.info.participants.filter((p) => p.teamId === 200);
    const blueTeam = match.info.participants.filter((p) => p.teamId === 100);
    const redWin = redTeam[0]?.win;
    const victoryTeam = redWin ? redTeam : blueTeam;
    const defeatTeam = redWin ? blueTeam : redTeam;

    if (player.win) wins++;
    totalKills += player.kills;
    totalDeaths += player.deaths;
    totalAssists += player.assists;
    totalDealt += player.totalDamageDealtToChampions || 0;
    totalTaken += player.totalDamageTaken || 0;
    totalMitigated += player.damageSelfMitigated || 0;
    totalHealing += player.totalHeal || 0;

    // Calculate values for placeholders
    const daysAgo = daysAgoFromTimestamp(match.info.gameEndTimestamp || match.info.gameCreation);
    const duration = `${Math.floor(match.info.gameDuration / 60)}:${String(match.info.gameDuration % 60).padStart(2, '0')}`;
    const champImgName = getChampImgName(player.championName);
    const champSrc = `https://ddragon.leagueoflegends.com/cdn/15.10.1/img/champion/${champImgName}.png`;
    const spell1Name = summonerSpellMap[player.summoner1Id] || "Unknown";
    const spell2Name = summonerSpellMap[player.summoner2Id] || "Unknown";
    const spell1Src = `https://ddragon.leagueoflegends.com/cdn/15.10.1/img/spell/${spell1Name}.png`;
    const spell2Src = `https://ddragon.leagueoflegends.com/cdn/15.10.1/img/spell/${spell2Name}.png`;
    const primaryRuneFile = runeIconMap[player.perks.styles[0].style] || "RunesIcon";
    const secondaryRuneFile = runeIconMap[player.perks.styles[1].style] || "RunesIcon";
    const primaryRuneSrc = `https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/${primaryRuneFile}.png`;
    const secondaryRuneSrc = `https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/${secondaryRuneFile}.png`;
    const kdaRatio = (player.deaths === 0)
      ? (player.kills + player.assists).toFixed(2)
      : ((player.kills + player.assists) / player.deaths).toFixed(2);
    const kdaText = `${player.kills} / ${player.deaths} / ${player.assists} (${kdaRatio})`;
    const cs = player.totalMinionsKilled || 0;
    const csPerMin = ((cs / (match.info.gameDuration / 60)) || 0).toFixed(1);
    const wards = player.wardsPlaced || 0;
    const itemsArr = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6];
    const itemDivs = itemsArr.map(id => {
      if (id) {
        return `<img src="https://ddragon.leagueoflegends.com/cdn/15.10.1/img/item/${id}.png" crossorigin="anonymous" alt="Item">`;
      } else {
        return `<div class="empty-slot"></div>`;
      }
    }).join("");
    const analysisFields = {
      kdaRatio: kdaRatio,
      totalDamage: (player.totalDamageDealtToChampions || 0).toLocaleString(),
      totalTaken: (player.totalDamageTaken || 0).toLocaleString(),
      mitigated: (player.damageSelfMitigated || 0).toLocaleString(),
      healing: (player.totalHeal || 0).toLocaleString(),
      goldEarned: (player.goldEarned || 0).toLocaleString(),
      goldPerMin: ((player.goldEarned || 0) / (match.info.gameDuration / 60)).toFixed(1),
      csPerMin: csPerMin,
      wardsPlaced: wards,
      visionScore: player.visionScore || 0,
      largestKillingSpree: player.largestKillingSpree || 0,
      largestMultiKill: player.largestMultiKill || 0
    };
    const winLabel = player.win ? "Win" : "Loss";
    // ---- CLONE TEMPLATE ----
    const clone = template.content.cloneNode(true);
    // Fill overview‐tab placeholders:
    clone.querySelector(".game-mode").textContent = match.info.gameMode;
    clone.querySelector(".days-ago").textContent = daysAgo;
    clone.querySelector(".game-duration").textContent = duration;
    const champImgEl = clone.querySelector(".champ-img");
    champImgEl.src = champSrc;
    champImgEl.alt = player.championName;
    clone.querySelector(".spell-1").src = spell1Src;
    clone.querySelector(".spell-2").src = spell2Src;
    clone.querySelector(".rune-primary").src = primaryRuneSrc;
    clone.querySelector(".rune-secondary").src = secondaryRuneSrc;
    clone.querySelector(".win-loss-label strong").textContent = winLabel;
    clone.querySelector(".kda-text").textContent = kdaText;
    clone.querySelector(".cs-text").textContent = `${cs} (${csPerMin})`;
    clone.querySelector(".wards-text").textContent = wards;
    clone.querySelector(".items").innerHTML = itemDivs;
    // Populate Victory / Defeat tables:
    const maxDamage = Math.max(...match.info.participants.map(p => p.totalDamageDealtToChampions || 0));
    function buildRow(playerObj) {
      const row = document.createElement("tr");
      const ptd1 = document.createElement("td");
      const imgName = getChampImgName(playerObj.championName);
      ptd1.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/15.10.1/img/champion/${imgName}.png" crossorigin="anonymous"> ${playerObj.summonerName}`;
      row.appendChild(ptd1);
      const kdaRat = (playerObj.deaths === 0)
        ? (playerObj.kills + playerObj.assists).toFixed(2)
        : ((playerObj.kills + playerObj.assists) / playerObj.deaths).toFixed(2);
      const ptd2 = document.createElement("td");
      ptd2.textContent = `${playerObj.kills}/${playerObj.deaths}/${playerObj.assists} (${kdaRat})`;
      row.appendChild(ptd2);
      const ptd3 = document.createElement("td");
      const dmg = playerObj.totalDamageDealtToChampions || 0;
      const barWidth = maxDamage ? (dmg / maxDamage) * 100 : 0;
      ptd3.innerHTML = `
        ${dmg}<br>
        <span class="bar" style="width:${barWidth}%;"></span>
      `;
      row.appendChild(ptd3);
      const ptd4 = document.createElement("td");
      const goldPM = ((playerObj.goldEarned || 0) / (match.info.gameDuration / 60)).toFixed(1);
      ptd4.textContent = `${playerObj.goldEarned} (${goldPM})`;
      row.appendChild(ptd4);
      const csCount = playerObj.totalMinionsKilled || 0;
      const ptd5 = document.createElement("td");
      const csPM = ((csCount) / (match.info.gameDuration / 60)).toFixed(1);
      ptd5.textContent = `${csCount} (${csPM})`;
      row.appendChild(ptd5);
      const ptd6 = document.createElement("td");
      ptd6.textContent = playerObj.wardsPlaced || 0;
      row.appendChild(ptd6);
      const ptd7 = document.createElement("td");
      const rowItems = [playerObj.item0, playerObj.item1, playerObj.item2, playerObj.item3, playerObj.item4, playerObj.item5, playerObj.item6];
      ptd7.innerHTML = rowItems.map(id => {
        if (id) {
          return `<img src=\"https://ddragon.leagueoflegends.com/cdn/15.10.1/img/item/${id}.png\" crossorigin=\"anonymous\">`;
        } else {
          return `<div class=\"empty-slot\"></div>`;
        }
      }).join("");
      row.appendChild(ptd7);
      return row;
    }
    const victoryBody = clone.querySelector(".victory-rows");
    const defeatBody = clone.querySelector(".defeat-rows");
    victoryTeam.forEach(p => victoryBody.appendChild(buildRow(p)));
    defeatTeam.forEach(p => defeatBody.appendChild(buildRow(p)));
    // Fill analysis‐tab placeholders:
    clone.querySelector(".analysis-kdaRatio").textContent = analysisFields.kdaRatio;
    clone.querySelector(".analysis-totalDamage").textContent = analysisFields.totalDamage;
    clone.querySelector(".analysis-totalTaken").textContent = analysisFields.totalTaken;
    clone.querySelector(".analysis-mitigated").textContent = analysisFields.mitigated;
    clone.querySelector(".analysis-healing").textContent = analysisFields.healing;
    clone.querySelector(".analysis-goldEarned").textContent = analysisFields.goldEarned;
    clone.querySelector(".analysis-goldPerMin").textContent = analysisFields.goldPerMin;
    clone.querySelector(".analysis-csPerMin").textContent = analysisFields.csPerMin;
    clone.querySelector(".analysis-wardsPlaced").textContent = analysisFields.wardsPlaced;
    clone.querySelector(".analysis-visionScore").textContent = analysisFields.visionScore;
    clone.querySelector(".analysis-largestKillingSpree").textContent = analysisFields.largestKillingSpree;
    clone.querySelector(".analysis-largestMultiKill").textContent = analysisFields.largestMultiKill;
    // Add tab‐switching and toggle‐details behavior:
    clone.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        const parentCard = btn.closest(".match-card");
        parentCard.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        parentCard.querySelector(".tab-overview").style.display = (btn.dataset.tab === "overview") ? "" : "none";
        parentCard.querySelector(".tab-analysis").style.display = (btn.dataset.tab === "analysis") ? "" : "none";
      });
    });
    // Entire card toggles details
    clone.querySelector(".match-card").addEventListener("click", e => {
      // only toggle if user clicked outside the tab buttons
      if (!e.target.classList.contains("tab-btn")) {
        toggleDetails(e.currentTarget);
      }
    });
    // Add win/loss class
    clone.querySelector(".match-card").classList.add(player.win ? "win" : "loss");
    // Finally, append the filled‐in clone to container
    container.appendChild(clone);
  }
  const winRate = ((wins / matches.length) * 100).toFixed(1);
  const kdaRatioTotal =
    totalDeaths === 0
      ? "∞"
      : ((totalKills + totalAssists) / totalDeaths).toFixed(2);
  const totalKDA = `${totalKills}/${totalDeaths}/${totalAssists}`;
  document.getElementById(
    "stat-damage"
  ).textContent = `Total Damage Dealt: ${totalDealt.toLocaleString()}`;
  document.getElementById(
    "stat-taken"
  ).textContent = `Total Damage Taken: ${totalTaken.toLocaleString()}`;
  document.getElementById(
    "stat-mitigated"
  ).textContent = `Self-Mitigated Damage: ${totalMitigated.toLocaleString()}`;
  document.getElementById(
    "stat-healing"
  ).textContent = `Total Healing Done: ${totalHealing.toLocaleString()}`;
  document.getElementById("stat-winrate").textContent = `Winrate: ${winRate}%`;
  document.getElementById("stat-kda").textContent = `Total K/D/A: ${totalKDA}`;
  document.getElementById(
    "stat-kdaratio"
  ).textContent = `KDA Ratio: ${kdaRatioTotal}`;
}
// 🆕 Display ranked info in the dashboard
function displayRankedInfo(ranks) {
  const rankDiv = document.getElementById("rankInfo");
  rankDiv.innerHTML = "<h3>Ranked Info</h3>";

  if (!Array.isArray(ranks) || ranks.length === 0) {
    rankDiv.innerHTML += "<p>Unranked in all queues.</p>";
    return;
  }

  for (const entry of ranks) {
    const { queueType, tier, rank, leaguePoints, wins, losses } = entry;
    const winrate = ((wins / (wins + losses)) * 100).toFixed(1);
    const label = queueType
      .replace("RANKED_SOLO_5x5", "Ranked Solo")
      .replace("RANKED_FLEX_SR", "Flex 5v5");

    const iconTier = tier.toLowerCase();
    const emblemSrc = `assets/emblems/${iconTier}.png`;

    rankDiv.innerHTML += `
      <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 18px;">
        <img src="${emblemSrc}" alt="${tier} Emblem" style="width: 64px; height: 64px;" />
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="font-weight: bold; font-size: 1.1em;">${label}</div>
          <div style="font-size: 1em;">${tier} ${rank} ${leaguePoints} LP</div>
          <div style="font-size: 0.97em; color: #60a5fa;">${wins}W / ${losses}L (${winrate}%)</div>
        </div>
      </div>
    `;
  }
}
document.addEventListener('DOMContentLoaded', () => {
  // Attach Matchup Info button handler after header is loaded
  const headerInterval = setInterval(() => {
    const btn = document.getElementById('matchupInfoBtn');
    if (btn) {
      btn.onclick = function() {
        window.location.href = 'matchup.html';
      };
      clearInterval(headerInterval);
    }
  }, 100);
});

// ───────── Auto‐search when dashboard.html?riotId=… ─────────
window.addEventListener("DOMContentLoaded", () => {
  // Only run on dashboard.html
  if (!window.location.pathname.endsWith("dashboard.html")) return;

  const params = new URLSearchParams(window.location.search);
  const riotIdParam = params.get("riotId");
  if (!riotIdParam) return;

  // Wait until header partial has injected #riotId and #searchBtn
  const checkHeaderReady = setInterval(() => {
    const riotInput = document.getElementById("riotId");
    const searchBtn = document.getElementById("searchBtn");
    if (riotInput && searchBtn) {
      clearInterval(checkHeaderReady);

      // 1) Fill in the Riot ID input
      riotInput.value = riotIdParam;

      // 2) Trigger the same behavior as clicking “Search”
      fetchMatchStats();
      document.body.classList.add("show-stats");
    }
  }, 100);
});

document.addEventListener("DOMContentLoaded", () => {
  const headerTarget = document.getElementById("header");
  if (headerTarget) {
    fetch("partials/header.html")
      .then((r) => r.text())
      .then((html) => {
        headerTarget.innerHTML = html;
      })
      .catch((err) => console.error("Error loading header.html:", err));
  }

  const dashboardTarget = document.getElementById("dashboard");
  if (dashboardTarget) {
    fetch("partials/dashboard.html")
      .then((r) => r.text())
      .then((html) => {
        dashboardTarget.innerHTML = html;
      })
      .catch((err) => console.error("Error loading dashboard partial:", err));
  }

  // Show total stats after search
  document.body.addEventListener("click", function (e) {
    if (
      (e.target && e.target.id === "searchBtn") ||
      (e.target && e.target.getAttribute && e.target.getAttribute("onclick") === "fetchMatchStats()")
    ) {
      document.body.classList.add("show-stats");
    }
  });

  // Attach dashboard search button handler to update URL without reload
  window.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.endsWith("dashboard.html")) return;

    // Wait until header partial has injected #riotId and #searchBtn
    const checkHandlerReady = setInterval(() => {
      const riotInput = document.getElementById("riotId");
      const searchBtn = document.getElementById("searchBtn");
      if (riotInput && searchBtn) {
        clearInterval(checkHandlerReady);
        // Remove any existing click handler
        searchBtn.onclick = null;
        // Add new click handler
        searchBtn.addEventListener("click", async () => {
          const input = riotInput.value.trim();
          if (!input) return;
          await fetchMatchStats();
          // Update the address bar to match the new Riot ID
          const newUrl = `dashboard.html?riotId=${encodeURIComponent(input)}`;
          window.history.replaceState(null, "", newUrl);
          document.body.classList.add("show-stats");
        });
        // Also handle Enter key
        riotInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            searchBtn.click();
          }
        });
      }
    }, 100);
  });

  // Allow pressing Enter in the username input to trigger search
  document.body.addEventListener("keydown", function (e) {
    const riotIdInput = document.getElementById("riotId");
    if (
      riotIdInput &&
      document.activeElement === riotIdInput &&
      (e.key === "Enter" || e.keyCode === 13)
    ) {
      const searchBtn = document.getElementById("searchBtn") || document.querySelector("button[onclick='fetchMatchStats()']");
      if (searchBtn) searchBtn.click();
    }
  });
});

// == Home‐page logic ==
document.addEventListener("DOMContentLoaded", () => {
  // Check for the home‐page elements; if they exist, wire up handlers:
  const homeSearchBtn   = document.getElementById("homeSearchBtn");
  const homeMatchupBtn  = document.getElementById("homeMatchupBtn");
  const homeRiotIdInput = document.getElementById("homeRiotId");

  if (homeSearchBtn && homeMatchupBtn && homeRiotIdInput) {
    homeSearchBtn.onclick = () => {
      const riotInputValue = homeRiotIdInput.value.trim();
      if (!riotInputValue) {
        alert("Please enter a Riot ID (e.g. lolarmon1#NA1).");
        return;
      }
      window.location.href = `dashboard.html?riotId=${encodeURIComponent(riotInputValue)}`;
    };

    homeMatchupBtn.onclick = () => {
      window.location.href = "matchup.html";
    };

    homeRiotIdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        homeSearchBtn.click();
      }
    });
  }
});