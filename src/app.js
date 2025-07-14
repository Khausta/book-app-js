import { BookDescriptionView } from "./components/book-description/book-description.js";
import { FavoritesView } from "./components/favorites/favorites.js";
import { MainView } from "./views/main/main.js";

class App {
    routes = [
        {path: "", view: MainView},
        {path: "#favorites", view: FavoritesView},
        {path: "#book-description", view: BookDescriptionView}

    ];
    appState = {
        favorites: [],
        selectedBook: []
    }
    constructor() {
        window.addEventListener('hashchange', this.route.bind(this));
        for (const key of Object.keys(localStorage)) {
            this.appState.favorites.push(JSON.parse(localStorage.getItem(key)))
        }
        this.route();
    }

    route() {
        if (this.currentView) {
            this.currentView.destroy();
        }
        const view = this.routes.find(r => r.path == location.hash).view;
        this.currentView = new view(this.appState);
        this.currentView.render();
    }
}

new App();