import { AbstractView } from "../../common/view";
import onChange from "on-change";
import { Header } from "../header/header";
// import { Card } from "../card/card";
import { AboutBook } from "../about-book/about-book.js"

export class BookDescriptionView extends AbstractView {

    //state не нужно, тк все состояние стоит appState в app.js
    constructor(appState) {
        super();
        this.appState = appState;        
        this.appState = onChange(this.appState, this.appStateHook.bind(this));
        this.setTitle('О книге');
    }

    destroy() {
        onChange.unsubscribe(this.appState);
    }

    appStateHook(path) {
        if (path === 'favorites') {
            this.render();
        }
    }

    render() {
        const main = document.createElement('div');
        main.innerHTML = `
            <h1>
                ${this.appState.selectedBook.title}
            </h1>
        `;
        main.append(new AboutBook(this.appState, this.appState.selectedBook).render());
        this.app.innerHTML = '';
        this.app.append(main);
        this.renderHeader();
    }

    renderHeader() {
        const header = new Header(this.appState).render();
        this.app.prepend(header);
    }
}