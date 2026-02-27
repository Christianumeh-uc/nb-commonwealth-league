import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
========================= */

const firebaseConfig = {
  apiKey: "AIzaSyDf3K6CIwN86J6kSoXe2B5MPioxzXhlVmI",
  authDomain: "nb-commonwealth-league.firebaseapp.com",
  projectId: "nb-commonwealth-league",
  storageBucket: "nb-commonwealth-league.firebasestorage.app",
  messagingSenderId: "751087586532",
  appId: "1:751087586532:web:a229a63c422a3b075270f1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================
   GLOBALS
========================= */

const ADMIN_PASSCODE = "NB2026";
let currentMatch = null;
let scorerChart = null;

const teams = [
  "AMASI FC",
  "BARTHO BOYS FC",
  "BUZZY GLOBAL FC",
  "CHUMIC STANDARD FC",
  "FC GALAXY",
  "JOHN MARSHAL FC",
  "NWA ANAYOEZE FC",
  "SANTA RESERVE FC"
];

/* =========================
   LOGIN
========================= */

window.openLogin = () => {
  document.getElementById("loginModal").style.display = "flex";
};

window.checkPasscode = () => {
  const input = document.getElementById("passcodeInput").value;
  if (input === ADMIN_PASSCODE) {
    document.getElementById("adminPanel").style.display = "block";
    document.getElementById("logoutBtn").style.display = "inline";
    document.getElementById("loginModal").style.display = "none";
  } else {
    alert("Incorrect passcode");
  }
};

window.logout = () => {
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
};

/* =========================
   INIT DROPDOWNS
========================= */

function populateTeams() {
  const home = document.getElementById("homeTeam");
  const away = document.getElementById("awayTeam");
  const teamSelect = document.getElementById("teamSelect");

  teams.forEach(t => {
    home.innerHTML += `<option value="${t}">${t}</option>`;
    away.innerHTML += `<option value="${t}">${t}</option>`;
    teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
  });
}
populateTeams();

/* =========================
   PLAYER REGISTRATION
========================= */

window.registerPlayer = async () => {
  const team = document.getElementById("teamSelect").value;
  const name = document.getElementById("playerName").value.trim();
  if (!name) return alert("Enter player name");

  await addDoc(collection(db, "players"), {
    team,
    name,
    goals: 0
  });

  document.getElementById("playerName").value = "";
  alert("Player registered");
};

/* =========================
   MATCH ENTRY FLOW
========================= */

window.startGoalEntry = () => {
  const home = document.getElementById("homeTeam").value;
  const away = document.getElementById("awayTeam").value;
  const homeGoals = parseInt(document.getElementById("homeGoals").value);
  const awayGoals = parseInt(document.getElementById("awayGoals").value);

  if (home === away) return alert("Same team selected");
  if (isNaN(homeGoals) || isNaN(awayGoals)) return alert("Enter valid scores");

  currentMatch = { home, away, homeGoals, awayGoals };

  const totalGoals = homeGoals + awayGoals;
  const goalInputs = document.getElementById("goalInputs");
  goalInputs.innerHTML = "";

  for (let i = 0; i < totalGoals; i++) {
    goalInputs.innerHTML += `<select class="scorerSelect"></select>`;
  }

  loadPlayersForScorers();
  document.getElementById("goalEntrySection").style.display = "block";
};

async function loadPlayersForScorers() {
  const snapshot = await getDocs(collection(db, "players"));
  const selects = document.querySelectorAll(".scorerSelect");

  selects.forEach(sel => {
    sel.innerHTML = "";
    snapshot.forEach(docSnap => {
      const p = docSnap.data();
      if (p.team === currentMatch.home || p.team === currentMatch.away) {
        sel.innerHTML += `<option value="${docSnap.id}">${p.name} (${p.team})</option>`;
      }
    });
  });
}

/* =========================
   SAVE MATCH
========================= */

window.saveMatch = async () => {

  await addDoc(collection(db, "matches"), {
    ...currentMatch,
    timestamp: Date.now()
  });

  // Update player goals
  const selects = document.querySelectorAll(".scorerSelect");
  for (let sel of selects) {
    const playerRef = doc(db, "players", sel.value);
    const snap = await getDoc(playerRef);
    if (snap.exists()) {
      await updateDoc(playerRef, {
        goals: snap.data().goals + 1
      });
    }
  }

  // Mark fixture as played
  const fixtureSnapshot = await getDocs(collection(db, "fixtures"));
  for (let fixtureDoc of fixtureSnapshot.docs) {
    const fixtureData = fixtureDoc.data();

    const updatedMatches = fixtureData.matches.map(match => {
      if (
        (match.home === currentMatch.home && match.away === currentMatch.away) ||
        (match.home === currentMatch.away && match.away === currentMatch.home)
      ) {
        return { ...match, played: true };
      }
      return match;
    });

    await updateDoc(doc(db, "fixtures", fixtureDoc.id), {
      matches: updatedMatches
    });
  }

  document.getElementById("goalEntrySection").style.display = "none";
  alert("Match saved successfully!");
};

/* =========================
   LIVE TABLE
========================= */

onSnapshot(collection(db, "matches"), snapshot => {

  let stats = {};
  teams.forEach(t => stats[t] = { MP:0,W:0,D:0,L:0,GF:0,GA:0,PTS:0 });

  snapshot.forEach(docSnap => {
    const m = docSnap.data();

    stats[m.home].MP++;
    stats[m.away].MP++;

    stats[m.home].GF += m.homeGoals;
    stats[m.home].GA += m.awayGoals;
    stats[m.away].GF += m.awayGoals;
    stats[m.away].GA += m.homeGoals;

    if (m.homeGoals > m.awayGoals) {
      stats[m.home].PTS+=3; stats[m.home].W++; stats[m.away].L++;
    } else if (m.homeGoals < m.awayGoals) {
      stats[m.away].PTS+=3; stats[m.away].W++; stats[m.home].L++;
    } else {
      stats[m.home].PTS++; stats[m.away].PTS++;
      stats[m.home].D++; stats[m.away].D++;
    }
  });

  renderTable(stats);
});

function renderTable(stats) {
  const table = document.getElementById("leagueTable");
  table.innerHTML = `
  <tr>
  <th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th>
  <th>GF</th><th>GA</th><th>GD</th><th>PTS</th>
  </tr>`;

  Object.keys(stats)
    .map(t => ({team:t,...stats[t],GD:stats[t].GF-stats[t].GA}))
    .sort((a,b)=> b.PTS - a.PTS || b.GD - a.GD)
    .forEach(r=>{
      table.innerHTML += `
      <tr>
      <td>${r.team}</td>
      <td>${r.MP}</td>
      <td>${r.W}</td>
      <td>${r.D}</td>
      <td>${r.L}</td>
      <td>${r.GF}</td>
      <td>${r.GA}</td>
      <td>${r.GD}</td>
      <td>${r.PTS}</td>
      </tr>`;
    });
}

/* =========================
   TOP SCORERS
========================= */

onSnapshot(collection(db, "players"), snapshot => {

  let players = [];
  snapshot.forEach(docSnap => players.push({id:docSnap.id,...docSnap.data()}));
  players.sort((a,b)=> b.goals - a.goals);

  document.getElementById("scorerList").innerHTML =
    players.map(p => `${p.name} (${p.team}) - ${p.goals} goals`).join("<br>");

  updateChart(players.slice(0,5));
});

function updateChart(players) {
  const ctx = document.getElementById("scorerChart");
  if (scorerChart) scorerChart.destroy();

  scorerChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: players.map(p=>p.name),
      datasets: [{
        label: "Goals",
        data: players.map(p=>p.goals)
      }]
    }
  });
}

/* =========================
   FIXTURES
========================= */

window.generateFixtures = async () => {

  const existing = await getDocs(collection(db, "fixtures"));
  if (!existing.empty) return alert("Fixtures already generated.");

  let rounds = [];
  let teamList = [...teams];
  const totalRounds = teamList.length - 1;
  const half = teamList.length / 2;

  for (let cycle = 0; cycle < 2; cycle++) {

    let rotating = teamList.slice(1);

    for (let round = 0; round < totalRounds; round++) {

      let matches = [];
      const left = [teamList[0], ...rotating.slice(0, half - 1)];
      const right = rotating.slice(half - 1).reverse();

      for (let i = 0; i < half; i++) {
        let home = cycle === 0 ? left[i] : right[i];
        let away = cycle === 0 ? right[i] : left[i];
        matches.push({ home, away, played:false });
      }

      rounds.push({
        round: rounds.length + 1,
        matches
      });

      rotating.unshift(rotating.pop());
    }
  }

  for (let r of rounds) {
    await addDoc(collection(db, "fixtures"), r);
  }

  alert("Fixtures generated successfully!");
};

onSnapshot(collection(db, "fixtures"), snapshot => {

  const container = document.getElementById("fixturesContainer");
  container.innerHTML = "";

  let rounds = [];
  snapshot.forEach(docSnap => rounds.push(docSnap.data()));
  rounds.sort((a,b)=> a.round - b.round);

  rounds.forEach(r => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>Round ${r.round}</strong><br>`;
    r.matches.forEach(m => {
      div.innerHTML += `${m.home} vs ${m.away} ${m.played ? "✅" : ""}<br>`;
    });
    container.appendChild(div);
  });
});

/* =========================
   MATCH HISTORY
========================= */

onSnapshot(collection(db, "matches"), snapshot => {

  const history = document.getElementById("matchHistory");
  history.innerHTML = "";

  snapshot.forEach(docSnap => {
    const m = docSnap.data();
    history.innerHTML += `
      <div>
        ${m.home} ${m.homeGoals} - ${m.awayGoals} ${m.away}
      </div>
    `;
  });
});

/* =========================
   RESET
========================= */

window.resetLeague = async () => {
  if (!confirm("Reset entire league results?")) return;

  const snapshot = await getDocs(collection(db, "matches"));
  for (let d of snapshot.docs) {
    await deleteDoc(doc(db, "matches", d.id));
  }

  alert("League reset successfully!");
};
