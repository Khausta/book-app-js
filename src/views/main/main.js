import { AbstractView } from "../../common/view.js";
import onChange from "on-change";
import { Header } from "../../components/header/header.js";
import { Search } from "../../components/search/search.js";
import { CardList } from "../../components/card-list/card-list.js";
import { Pagination } from "../../components/pagination/pagination.js";

export class MainView extends AbstractView {
    state = sessionStorage.getItem('lastSearch') != undefined ?  JSON.parse(sessionStorage.getItem('lastSearch')) : {
        list: [],
        numFound: 0,
        loading: false, 
        searchQuery: undefined,
        offset: 0,
        docs: [],
        start: 0,
        end: 9
    };

    constructor(appState) {
        super();
        this.appState = appState;
        this.appState = onChange(this.appState, this.appStateHook.bind(this));
        this.state = onChange(this.state, this.stateHook.bind(this));
        this.setTitle('Поиск книг');
    }

    destroy() {
        onChange.unsubscribe(this.appState);
        onChange.unsubscribe(this.state);
    }

    appStateHook(path) {
        if (path === 'favorites') {
            this.render();
        }
    }

    async stateHook(path) {
        if (path === 'searchQuery' || path === 'offset') {
            this.state.loading = true;
            const data = await this.loadList(this.state.searchQuery, this.state.offset, this.state.start);
            this.state.loading = false;
            this.state.numFound = data.numFound;  
            this.state.docs = data.docs;
            this.state.list = this.state.docs.slice(this.state.start, this.state.end);
            console.log(this.state);
            
            
        }

        if (path === 'list' || path === 'loading' || path === 'start' ) {
            this.render();
        }
    }

    async loadList(q, offset, start) {
        const res = await fetch(`https://openlibrary.org/search.json?q=${q}&offset=${offset}&start=${start}`);
        return res.json();
    }

    render() {
        console.log('before render')
        console.log(sessionStorage.length)

        const main = document.createElement('div');
        main.innerHTML = `
            <h1>
                Найдено книг - ${this.state.numFound}
            </h1>
        `;
        main.append(new Search(this.state).render());
        main.append(new CardList(this.appState, this.state).render());
        main.append(new Pagination(this.state).render());
        this.app.innerHTML = '';
        this.app.append(main);
        this.renderHeader();

    }

    renderHeader() {
        const header = new Header(this.appState).render();
        this.app.prepend(header);
    }
}