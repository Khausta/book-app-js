import { DivComponent } from "../../common/div-component";
// import onChange from "on-change";s
import './about-book.css'


export class AboutBook extends DivComponent {

    constructor(appState, bookState) {
        super();
        this.appState = appState;
        this.bookState = bookState;
    }

    #addToFavorites() {
        this.appState.favorites.push(this.bookState); 
    }

    #deleteFromFavorites() {
        this.appState.favorites = this.appState.favorites.filter(
            b => b.key !== this.bookState.key
        );
    }

    render() {
        this.el.classList.add('book');
        const existInFavorites = this.appState.favorites.find(
            b => b.key === this.bookState.key
        );
        
        this.el.innerHTML = `
            
            <div class="book__info">
                <div class="book__image">
                    <img src="https://covers.openlibrary.org/b/olid/${this.bookState.cover_edition_key}-M.jpg" alt="обложка" />
                </div>
                <div class="book__characters">
                    <div class="book__author">
                    Author: <span>${this.bookState.author_name ? this.bookState.author_name[0] : 'Not found'}</span>
                    </div>
                    <div class="book__category">
                        Category: <span>${this.bookState.subject ? this.bookState.subject[0] : 'Not found'}</span>
                    </div>
                    <div class="book__first-publication">
                        First publication: <span>${this.bookState.publish_year ? this.bookState.publish_year[0] : 'Not found'}</span>
                    </div>
                    <div class="book__pages">
                        Number of pages: <span>${this.bookState.number_of_pages_median ? this.bookState.number_of_pages_median : 'Not found'}</span>
                    </div>
                    <button class="button_add-book ${existInFavorites ? 'button_active-book' : ''}">
                        ${existInFavorites
                            ? 'Remove from favorites'
                            : 'Add to favorites' 
                        }
                    </button>
                </div>
                
            </div>
            <p>Description:</p>
            <div class="book__description">
                Text of description
            </div>
            <p>Tags:</p> 
            <div class="book__tags">
            </div> 
        `;

        const tagsBlock = this.el.querySelector('.book__tags');
        const tags = this.bookState.subject;
        if(tags) {
            for (const tag of tags) {
                const el = document.createElement('span');
                el.innerHTML = tag;
                tagsBlock.append(el);    
            }
        }
        
        if(existInFavorites) {
            this.el.querySelector('button').addEventListener('click', this.#deleteFromFavorites.bind(this))
        } else {
            this.el.querySelector('button').addEventListener('click', this.#addToFavorites.bind(this))
        }

      
        return this.el;
    }
}


