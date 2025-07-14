import { DivComponent } from "../../common/div-component.js";
import './card.css';

export class Card extends DivComponent{
    constructor(appState, cardState) {
        super();
        this.appState = appState;
        this.cardState = cardState; 
    }

    #addToFavorites(event) {
        event.stopPropagation();
        this.appState.favorites.push(this.cardState);
        localStorage.setItem(this.cardState.key.replace('/works/', ''), JSON.stringify(this.cardState));
    }

    #deleteFromFavorites(event) {
        event.stopPropagation();
        this.appState.favorites = this.appState.favorites.filter(
            b => b.key !== this.cardState.key
        );
        localStorage.removeItem(this.cardState.key);
    }

    href(event) {     
        if (event.target.nodeName === 'BUTTON') return false;
        if(this.appState.selectedBook.length) this.appState.selectedBook.pop();
        this.appState.selectedBook = this.cardState;
        window.location.href = '#book-description';
    }

    render() {
        this.el.classList.add('card');
        const existInFavorites = this.appState.favorites.find(
            b => b.key === this.cardState.key
        );
        
        this.el.innerHTML = `
            <div class="card__image">
                <img src="https://covers.openlibrary.org/b/olid/${this.cardState.cover_edition_key}-M.jpg" alt="обложка" />
            </div>
            <div class="card__info">
                <div class="card__tag">
                    ${this.cardState.subject ? this.cardState.subject[0] : 'Не задано'}
                </div>
                <div class="card__name">
                    ${this.cardState.title}
                </div>
                <div class="card__author">
                    ${this.cardState.author_name ? this.cardState.author_name[0] : 'Не задано'}
                </div>
                <div class="card__footer">
                    <button class="button_add ${existInFavorites ? 'button__active' : ''}">
                        ${existInFavorites
                            ? '<img src="./static/favorites.svg" />'
                            : '<img src="./static/favorites-white.svg" />' 
                        }
                    </button>
                </div>
            </div>

            
        `;
        //   add/remove button
        if(existInFavorites) {
            this.el.querySelector('button').addEventListener('click', this.#deleteFromFavorites.bind(this))
        } else {
            this.el.querySelector('button').addEventListener('click', this.#addToFavorites.bind(this))
        }
        //   link to book details
        this.el.addEventListener('click', this.href.bind(this));

        return this.el;
    }
}