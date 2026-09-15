package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.dto.CategoryRequest;
import com.example.cafemangmentsystem.menu.dto.CategoryResponse;
import com.example.cafemangmentsystem.menu.entity.Category;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryResponse create(CategoryRequest request) {
        Category category = new Category();
        category.setNameAr(request.nameAr());
        category.setNameEn(request.nameEn());
        category.setDisplayOrder(request.displayOrder());

        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> findAll() {
        return categoryRepository.findAllByOrderByDisplayOrderAsc().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CategoryResponse findById(Long id) {
        return CategoryResponse.from(getOrThrow(id));
    }

    public CategoryResponse update(Long id, CategoryRequest request) {
        Category category = getOrThrow(id);
        category.setNameAr(request.nameAr());
        category.setNameEn(request.nameEn());
        category.setDisplayOrder(request.displayOrder());
        return CategoryResponse.from(category);
    }

    /**
     * Deletes a category outright. Its products survive it.
     *
     * <p>Not a cascade, deliberately: deleting a category must never become a way to wipe a menu
     * by accident. V11 makes products.category_id ON DELETE SET NULL, so the products stay on
     * sale and surface in the POS under أخرى / غير مصنّف, which the menu grid already groups and
     * draws. Past order lines are untouched either way - they carry category_name_snapshot.
     */
    public void delete(Long id) {
        categoryRepository.delete(getOrThrow(id));
    }

    public CategoryResponse deactivate(Long id, Long deactivatedByUserId) {
        Category category = getOrThrow(id);
        category.deactivate(deactivatedByUserId);
        return CategoryResponse.from(category);
    }

    public CategoryResponse activate(Long id) {
        Category category = getOrThrow(id);
        category.activate();
        return CategoryResponse.from(category);
    }

    Category getOrThrow(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found: " + id));
    }
}